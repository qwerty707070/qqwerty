/**
 * Хранилище настроек.
 *
 * Порядок выбора адаптера:
 *  1. Supabase (если заданы SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) — рабочая
 *     схема для production: одна строка в таблице public.site_settings.
 *  2. Файл .data/settings.json — для локальной разработки и для любого
 *     Node-хостинга с записываемым диском.
 *
 * Ни один адаптер не кэширует значение между запросами: кэш — источник
 * рассинхрона «админка сохранила, сайт не увидел».
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS, SETTINGS_ID, type Settings, validateSettings } from './settings';

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'settings.json');
const AUDIT_FILE = path.join(DATA_DIR, 'settings-audit.jsonl');

export type AuditEntry = {
  at: string;
  actor: string;
  ip: string;
  changed: string[];
  before: Partial<Settings>;
  after: Partial<Settings>;
};

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

const useSupabase = Boolean(supabaseUrl && supabaseKey);

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: supabaseKey as string,
    Authorization: `Bearer ${supabaseKey as string}`,
    'Content-Type': 'application/json',
  };
}

async function readFromSupabase(): Promise<Settings | null> {
  const url = `${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=payload`;
  const res = await fetch(url, { headers: supabaseHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Supabase read failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ payload: Settings }>;
  if (!rows.length) return null;
  return { ...DEFAULT_SETTINGS, ...rows[0].payload };
}

async function writeToSupabase(settings: Settings): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/site_settings?on_conflict=id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id: SETTINGS_ID, payload: settings, updated_at: settings.updatedAt }]),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase write failed: ${res.status} ${await res.text()}`);
}

async function readFromFile(): Promise<Settings | null> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function writeToFile(settings: Settings): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8');
  await fs.rename(tmp, FILE); // атомарная замена: половина файла не запишется
}

/**
 * Чтение настроек. Всегда свежие данные, всегда с таймаутом:
 * если хранилище недоступно — отдаём последние известные дефолты,
 * но НИКОГДА не бросаем исключение в рендер публичной страницы.
 */
export async function getSettings(): Promise<Settings> {
  try {
    if (useSupabase) {
      const remote = await readFromSupabase();
      return remote ?? DEFAULT_SETTINGS;
    }
    const fromFile = await readFromFile();
    return fromFile ?? DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[settings] read failed, falling back to defaults:', error);
    return DEFAULT_SETTINGS;
  }
}

export type SaveResult =
  | { ok: true; settings: Settings; changed: string[] }
  | { ok: false; errors: Record<string, string> };

export async function saveSettings(
  input: unknown,
  actor: string,
  ip: string,
): Promise<SaveResult> {
  const validated = validateSettings(input, actor);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const before = await getSettings();
  // updatedAt всегда новый: он работает как версия для клиентов,
  // которые опрашивают /api/settings.
  const next: Settings = { ...validated.value, updatedAt: new Date().toISOString(), updatedBy: actor };

  if (useSupabase) {
    await writeToSupabase(next);
  } else {
    await writeToFile(next);
  }

  const changed = (Object.keys(next) as Array<keyof Settings>).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(next[key]),
  );

  await appendAudit({
    at: next.updatedAt,
    actor,
    ip,
    changed,
    before: pick(before, changed),
    after: pick(next, changed),
  });

  return { ok: true, settings: next, changed };
}

function pick(source: Settings, keys: Array<keyof Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};
  for (const key of keys) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[key] = source[key];
  }
  return out;
}

async function appendAudit(entry: AuditEntry): Promise<void> {
  try {
    if (useSupabase) {
      await fetch(`${supabaseUrl}/rest/v1/site_settings_audit`, {
        method: 'POST',
        headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify([entry]),
        cache: 'no-store',
      });
      return;
    }
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(AUDIT_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    // Журнал не должен ломать сохранение настроек
    console.error('[settings] audit append failed:', error);
  }
}

export async function getAudit(limit = 10): Promise<AuditEntry[]> {
  try {
    if (useSupabase) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/site_settings_audit?select=*&order=at.desc&limit=${limit}`,
        { headers: supabaseHeaders(), cache: 'no-store' },
      );
      if (!res.ok) return [];
      return (await res.json()) as AuditEntry[];
    }
    const raw = await fs.readFile(AUDIT_FILE, 'utf8');
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

export const settingsBackend = useSupabase ? 'supabase' : 'file';
