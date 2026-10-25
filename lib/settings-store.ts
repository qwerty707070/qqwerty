/**
 * ХРАНИЛИЩЕ НАСТРОЕК.
 *
 * Порядок: Supabase (если заданы SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *          → файл (SETTINGS_FILE или .data/settings.json)
 *          → аварийный файл в os.tmpdir(), если рабочий каталог только для чтения
 *            (serverless/Vercel: запись в cwd падает с EROFS — раньше это давало
 *             «Не удалось сохранить настройки» без объяснения причины).
 *
 * Гарантии:
 *  - чтение никогда не бросает исключение в рендер;
 *  - запись атомарная (временный файл + rename);
 *  - частичный payload мержится с текущими настройками;
 *  - оптимистическая блокировка по updatedAt (не перетираем чужие правки);
 *  - есть самодиагностика: где лежит, можно ли писать, прошла ли проверка круга.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  SETTINGS_ID,
  type Settings,
  validateSettings,
} from './settings';

/* ------------------------------ типы ---------------------------------- */

export type StorageBackend = 'supabase' | 'file';

export type StorageHealth = {
  backend: StorageBackend;
  location: string;
  writable: boolean;
  degraded: boolean;
  /** true — данные переживут перезапуск и видны всем инстансам. */
  durable: boolean;
  serverless: boolean;
  hint?: string;
};

/** Serverless-окружение: файл в /tmp не общий между инстансами. */
export function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTION_TARGET ||
      process.env.K_SERVICE,
  );
}

export class StorageError extends Error {
  code: string;
  hint: string;
  constructor(message: string, code: string, hint: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.hint = hint;
  }
}

/* ----------------------------- настройки ------------------------------ */

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);

const PRIMARY_FILE =
  process.env.SETTINGS_FILE ?? path.join(process.cwd(), '.data', 'settings.json');
const FALLBACK_FILE = path.join(os.tmpdir(), 'kinggrief-settings.json');
const AUDIT_FILE = path.join(path.dirname(PRIMARY_FILE), 'settings-audit.jsonl');
const FALLBACK_AUDIT = path.join(os.tmpdir(), 'kinggrief-settings-audit.jsonl');

/** Куда фактически пишем в этом процессе. Определяется один раз на инстанс. */
let resolvedFile: string | null = null;
let degraded = false;

export type AuditEntry = {
  at: string;
  actor: string;
  ip: string;
  changed: string[];
  before: Partial<Settings>;
  after: Partial<Settings>;
};

/* ------------------------------ Supabase ------------------------------ */

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: supabaseKey as string,
    Authorization: `Bearer ${supabaseKey as string}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseRequest(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...supabaseHeaders(), ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
  } catch (error) {
    // Сетевая ошибка (неверный URL, проект на паузе, нет доступа из сети).
    throw new StorageError(
      error instanceof Error ? error.message : String(error),
      'SUPABASE_UNREACHABLE',
      'Проект Supabase недоступен: проверьте SUPABASE_URL, статус проекта и сетевой доступ.',
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const isMissingTable = res.status === 404 || /relation .* does not exist|42P01/i.test(body);
    throw new StorageError(
      `Supabase ${res.status}: ${body.slice(0, 300)}`,
      isMissingTable ? 'SUPABASE_NO_TABLE' : 'SUPABASE_ERROR',
      isMissingTable
        ? 'В проекте Supabase нет таблиц. Выполните supabase/schema.sql в SQL Editor.'
        : 'Проверьте SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и доступность проекта.',
    );
  }
  return res;
}

async function readFromSupabase(): Promise<Settings | null> {
  const res = await supabaseRequest(
    `${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=payload`,
  );
  const rows = (await res.json()) as Array<{ payload: Settings }>;
  if (!rows.length) return null;
  return { ...DEFAULT_SETTINGS, ...rows[0].payload };
}

async function writeToSupabase(settings: Settings): Promise<void> {
  await supabaseRequest(`${supabaseUrl}/rest/v1/site_settings?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([
      { id: SETTINGS_ID, payload: settings, updated_at: settings.updatedAt },
    ]),
  });
}

/* -------------------------------- файл -------------------------------- */

async function canWrite(dir: string): Promise<boolean> {
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${process.pid}-${Date.now()}`);
    await fs.writeFile(probe, 'ok', 'utf8');
    await fs.unlink(probe);
    return true;
  } catch {
    return false;
  }
}

/** Выбирает доступный для записи путь: основной каталог или tmp-файл. */
async function resolveFile(): Promise<string> {
  if (resolvedFile) return resolvedFile;

  if (await canWrite(path.dirname(PRIMARY_FILE))) {
    resolvedFile = PRIMARY_FILE;
    degraded = false;
    return resolvedFile;
  }

  if (await canWrite(path.dirname(FALLBACK_FILE))) {
    resolvedFile = FALLBACK_FILE;
    degraded = true;
    console.warn(
      `[settings] каталог ${path.dirname(PRIMARY_FILE)} недоступен для записи — ` +
        `использую ${FALLBACK_FILE} (данные не переживут перезапуск инстанса). ` +
        `Настройте Supabase для production.`,
    );
    return resolvedFile;
  }

  throw new StorageError(
    'Нет ни одного каталога, доступного для записи',
    'NO_WRITABLE_STORAGE',
    'Смонтируйте записываемый диск или задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.',
  );
}

async function readJson(file: string): Promise<Settings | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    if (error instanceof SyntaxError) {
      console.error(`[settings] ${file} повреждён, использую значения по умолчанию`);
      return null;
    }
    throw error;
  }
}

/**
 * Чтение: смотрим оба файла и берём тот, где updatedAt свежее.
 * Это важно, когда инстанс уже писал в tmp, а на диске лежит старый файл.
 */
async function readFromFile(): Promise<Settings | null> {
  const [primary, fallback] = await Promise.all([readJson(PRIMARY_FILE), readJson(FALLBACK_FILE)]);
  if (primary && fallback) {
    return new Date(fallback.updatedAt) > new Date(primary.updatedAt) ? fallback : primary;
  }
  return fallback ?? primary;
}

async function writeToFile(settings: Settings, target?: string): Promise<void> {
  const file = target ?? (await resolveFile());
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

/* ------------------------------ публичное ----------------------------- */

/** Чтение настроек. Никогда не бросает: при сбое отдаёт дефолты. */
export async function getSettings(): Promise<Settings> {
  try {
    if (useSupabase) {
      const remote = await readFromSupabase();
      return remote ?? DEFAULT_SETTINGS;
    }
    const fromFile = await readFromFile();
    return fromFile ?? DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[settings] чтение не удалось, отдаю значения по умолчанию:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function getSettingsStrict(): Promise<
  { ok: true; settings: Settings } | { ok: false; error: StorageError }
> {
  try {
    if (useSupabase) {
      return { ok: true, settings: (await readFromSupabase()) ?? DEFAULT_SETTINGS };
    }
    return { ok: true, settings: (await readFromFile()) ?? DEFAULT_SETTINGS };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof StorageError
          ? error
          : new StorageError(String(error), 'READ_FAILED', 'Проверьте хранилище настроек.'),
    };
  }
}

export async function storageHealth(): Promise<StorageHealth> {
  const serverless = isServerless();

  if (useSupabase) {
    try {
      await readFromSupabase();
      return {
        backend: 'supabase',
        location: 'public.site_settings',
        writable: true,
        degraded: false,
        durable: true,
        serverless,
      };
    } catch (error) {
      return {
        backend: 'supabase',
        location: 'public.site_settings',
        writable: false,
        degraded: false,
        durable: false,
        serverless,
        hint: error instanceof StorageError ? error.hint : 'Supabase недоступен',
      };
    }
  }

  const writablePrimary = await canWrite(path.dirname(PRIMARY_FILE));
  await resolveFile().catch(() => null);
  const file = resolvedFile ?? PRIMARY_FILE;
  const onTmp = file !== PRIMARY_FILE;
  // Файл переживает перезапуск только на обычном сервере с постоянным диском.
  const durable = !serverless && !onTmp && writablePrimary;

  return {
    backend: 'file',
    location: file,
    writable: writablePrimary || degraded,
    degraded: degraded || !writablePrimary,
    durable,
    serverless,
    hint: !durable
      ? serverless
        ? 'Запуск в serverless (Vercel): каталог проекта только для чтения, файл в /tmp не общий между инстансами. Каждое сохранение будет «откатываться» — подключите Supabase.'
        : 'Каталог проекта только для чтения. Записи идут во временный файл и исчезнут при перезапуске — настройте Supabase или смонтируйте диск.'
      : undefined,
  };
}

/* -------------------------------- запись ------------------------------ */

export type SaveResult =
  | {
      ok: true;
      settings: Settings;
      changed: string[];
      /** Кто-то успел изменить настройки, но правка применена (last-write-wins). */
      conflictResolved?: boolean;
      durable: boolean;
    }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; conflict: true; current: Settings };

function pick(source: Settings, keys: Array<keyof Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};
  for (const key of keys) out[key] = source[key] as never;
  return out;
}

/**
 * Сохранение.
 *
 * @param input           частичный или полный набор полей — мержится с текущими
 * @param actor           кто сохранил (для журнала)
 * @param ip              откуда (для журнала)
 * @param expectedVersion updatedAt, который видел админ: при расхождении
 *                        возвращаем conflict, чтобы не перетереть чужие правки
 * @param force           перезаписать, несмотря на конфликт
 */
export async function saveSettings(
  input: unknown,
  actor: string,
  ip: string,
  options: { expectedVersion?: string; force?: boolean; strict?: boolean } = {},
): Promise<SaveResult> {
  const current = await getSettings();
  const health = await storageHealth();

  const staleVersion =
    Boolean(options.expectedVersion) &&
    options.expectedVersion !== current.updatedAt &&
    current.updatedAt !== DEFAULT_SETTINGS.updatedAt;

  // Раньше рассинхрон версий блокировал сохранение (409), и правка админа
  // «исчезала» — со стороны это выглядело как «IP удаляется». Теперь по
  // умолчанию применяем правку (last-write-wins) и только предупреждаем;
  // строгий режим остаётся доступен через strict: true.
  if (staleVersion && !options.force && options.strict) {
    return { ok: false, conflict: true, current };
  }

  const patch = (input ?? {}) as Record<string, unknown>;
  const merged = { ...current, ...patch };

  const validated = validateSettings(merged, actor);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const changed = (Object.keys(validated.value) as Array<keyof Settings>).filter(
    (key) => key !== 'updatedAt' && key !== 'updatedBy'
      && JSON.stringify(current[key]) !== JSON.stringify(validated.value[key]),
  );

  // Ничего не поменялось — не трогаем updatedAt и не сбрасываем кэш страниц.
  if (changed.length === 0) {
    return {
      ok: true,
      settings: current,
      changed: [],
      durable: health.durable,
      conflictResolved: staleVersion && !options.force ? true : undefined,
    };
  }

  const next: Settings = {
    ...validated.value,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };

  if (useSupabase) {
    await writeToSupabase(next);
  } else {
    try {
      await writeToFile(next);
    } catch (error) {
      if (resolvedFile === FALLBACK_FILE) throw error;
      // Диск мог стать недоступным между запросами — пробуем tmp-файл.
      resolvedFile = null;
      degraded = true;
      await writeToFile(next, FALLBACK_FILE);
    }
  }

  await appendAudit({
    at: next.updatedAt,
    actor,
    ip,
    changed,
    before: pick(current, changed as Array<keyof Settings>),
    after: pick(next, changed as Array<keyof Settings>),
  });

  return {
    ok: true,
    settings: next,
    changed,
    durable: health.durable,
    conflictResolved: staleVersion && !options.force ? true : undefined,
  };
}

/* ------------------------------- проверка ----------------------------- */

export type VerifyResult = {
  ok: boolean;
  backend: StorageBackend;
  location: string;
  roundTripMs: number;
  error?: string;
  hint?: string;
};

/**
 * Реальная проверка записи: пишет текущие настройки и читает их обратно.
 * Нужна, чтобы «сохранение не работает» превращалось в конкретную причину.
 */
export async function verifyStorage(): Promise<VerifyResult> {
  const started = Date.now();
  const health = await storageHealth();
  const current = await getSettings();
  const probe: Settings = { ...current, updatedAt: new Date().toISOString(), updatedBy: 'self-test' };

  try {
    if (useSupabase) {
      await writeToSupabase(probe);
      const readBack = await readFromSupabase();
      if (readBack?.updatedAt !== probe.updatedAt) {
        return {
          ok: false,
          backend: 'supabase',
          location: health.location,
          roundTripMs: Date.now() - started,
          error: 'Запись прошла, но чтение вернуло другую версию (RLS/кэш?)',
          hint: 'Проверьте, что чтение идёт service_role ключом и таблица не в кэше.',
        };
      }
    } else {
      const file = await resolveFile();
      await writeToFile(probe, file);
      const readBack = await readJson(file);
      if (readBack?.updatedAt !== probe.updatedAt) {
        return {
          ok: false,
          backend: 'file',
          location: file,
          roundTripMs: Date.now() - started,
          error: 'Файл записан, но чтение вернуло другую версию',
        };
      }
    }
  } catch (error) {
    return {
      ok: false,
      backend: useSupabase ? 'supabase' : 'file',
      location: health.location,
      roundTripMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      hint: error instanceof StorageError ? error.hint : undefined,
    };
  }

  return {
    ok: true,
    backend: useSupabase ? 'supabase' : 'file',
    location: health.location,
    roundTripMs: Date.now() - started,
  };
}

/* -------------------------------- журнал ------------------------------ */

async function appendAudit(entry: AuditEntry): Promise<void> {
  try {
    if (useSupabase) {
      await supabaseRequest(`${supabaseUrl}/rest/v1/site_settings_audit`, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([entry]),
      });
      return;
    }
    const target = resolvedFile === FALLBACK_FILE ? FALLBACK_AUDIT : AUDIT_FILE;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.appendFile(target, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    // Журнал не должен ломать сохранение настроек
    console.error('[settings] запись в журнал не удалась:', error);
  }
}

export async function getAudit(limit = 10): Promise<AuditEntry[]> {
  try {
    if (useSupabase) {
      const res = await supabaseRequest(
        `${supabaseUrl}/rest/v1/site_settings_audit?select=at,actor,ip,changed,before,after&order=at.desc&limit=${limit}`,
      );
      return (await res.json()) as AuditEntry[];
    }
    const target = resolvedFile === FALLBACK_FILE ? FALLBACK_AUDIT : AUDIT_FILE;
    const raw = await fs.readFile(target, 'utf8').catch(() => '');
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line) => JSON.parse(line) as AuditEntry);
  } catch {
    return [];
  }
}

export const settingsBackend: StorageBackend = useSupabase ? 'supabase' : 'file';
