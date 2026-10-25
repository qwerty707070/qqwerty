/**
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ ДЛЯ НАСТРОЕК САЙТА.
 * Ни один компонент не хранит собственную копию IP/ссылок/версий.
 */

export type ServerStatus = 'online' | 'offline' | 'maintenance' | 'soon';

export type Settings = {
  brand: string;
  season: string;
  tagline: string;

  // Подключение к серверу — то самое поле из админки
  serverName: string;
  serverIp: string;
  serverPort: number | null;
  versions: string;
  javaRangeHint: string;

  // Ссылки
  discordUrl: string;
  telegramUrl: string;
  supportEmail: string;

  // Живой статус
  status: ServerStatus;
  onlinePlayers: number | null;
  maxPlayers: number | null;

  // Магазин
  storeOpen: boolean;
  storeClosedMessage: string;

  // Служебное
  updatedAt: string;
  updatedBy: string;
};

export const SETTINGS_ID = 'singleton';

export const DEFAULT_SETTINGS: Settings = {
  brand: 'KINGGRIEF',
  season: 'Сезон I · Восхождение короля',
  tagline: 'Твоя империя грифа',
  serverName: 'KingGrief',
  serverIp: 'play.kinggrief.net',
  serverPort: 25565,
  versions: '1.16.5 — 1.21.4',
  javaRangeHint: 'Java Edition · лицензия и пиратка',
  discordUrl: 'https://discord.gg/kinggrief',
  telegramUrl: 'https://t.me/kinggrief',
  supportEmail: 'support@kinggrief.net',
  status: 'soon',
  onlinePlayers: null,
  maxPlayers: null,
  storeOpen: true,
  storeClosedMessage: 'Магазин временно закрыт — заходите чуть позже.',
  updatedAt: '1970-01-01T00:00:00.000Z',
  updatedBy: 'system',
};

export const STATUS_LABELS: Record<ServerStatus, string> = {
  online: 'Сервер онлайн',
  offline: 'Сервер офлайн',
  maintenance: 'Технические работы',
  soon: 'Статус уточняется',
};

/* ------------------------------------------------------------------ */
/* Адрес сервера                                                       */
/* ------------------------------------------------------------------ */

const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))*$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function isValidHost(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (IPV4_RE.test(v)) {
    return v.split('.').every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255 && !/^0\d/.test(part);
    });
  }
  if (v.includes('://') || v.includes('/') || v.includes(' ') || v.includes(':')) return false;
  return HOSTNAME_RE.test(v);
}

/**
 * Админ часто вставляет адрес целиком: «play.kinggrief.net:25565».
 * Раньше это отвергалось как «некорректный IP» — то есть с точки зрения
 * пользователя «сохранение не работает». Теперь разбираем на хост и порт.
 */
export function splitHostPort(input: string): { host: string; port: number | null } {
  const value = input.trim();
  const match = /^(.*?)(?::(\d{1,5}))?$/.exec(value);
  const host = (match?.[1] ?? value).trim();
  const portRaw = match?.[2];
  const port = portRaw ? Number(portRaw) : null;
  return { host, port: port !== null && port >= 1 && port <= 65535 ? port : null };
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Валидация                                                           */
/* ------------------------------------------------------------------ */

export type ValidationResult =
  | { ok: true; value: Settings }
  | { ok: false; errors: Record<string, string> };

/**
 * Принимает ПОЛНЫЙ объект настроек. Частичные правки мержатся с текущими
 * значениями в lib/settings-store.ts (иначе PUT только с одним полем
 * падал с «Ожидается текст» на всех остальных).
 */
export function validateSettings(input: unknown, actor: string): ValidationResult {
  const errors: Record<string, string> = {};
  const raw = (input ?? {}) as Record<string, unknown>;

  const str = (key: keyof Settings, max: number, label: string): string => {
    const value = raw[key];
    if (typeof value !== 'string') {
      errors[key] = `${label}: ожидается текст`;
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      errors[key] = `${label}: не может быть пустым`;
      return '';
    }
    if (trimmed.length > max) {
      errors[key] = `${label}: максимум ${max} символов`;
      return '';
    }
    return trimmed;
  };

  const brand = str('brand', 32, 'Название проекта');
  const season = str('season', 80, 'Сезон');
  const tagline = str('tagline', 120, 'Слоган');
  const serverName = str('serverName', 48, 'Название сервера');
  const versions = str('versions', 48, 'Версии');
  const javaRangeHint = str('javaRangeHint', 80, 'Подпись версий');
  const discordUrl = str('discordUrl', 200, 'Discord');
  const telegramUrl = str('telegramUrl', 200, 'Telegram');
  const supportEmail = str('supportEmail', 120, 'E-mail');
  const storeClosedMessage = str('storeClosedMessage', 200, 'Сообщение о закрытии');

  // --- адрес: принимаем и «host», и «host:port»
  //
  // Приоритет: порт, вписанный прямо в адрес, важнее отдельного поля.
  // Раньше было наоборот — админ печатал «mc.example.net:25566», а в поле
  // порта оставался 25565, и сохранялся 25565. Со стороны это выглядело
  // как «сохранение не работает».
  let serverIp = '';
  let serverPort: number | null = null;
  let portFromAddress: number | null = null;

  const rawIp = raw.serverIp;
  if (typeof rawIp !== 'string') {
    errors.serverIp = 'IP: ожидается текст';
  } else {
    const parsed = splitHostPort(rawIp);
    serverIp = parsed.host;
    if (!parsed.host) {
      errors.serverIp = 'IP: укажите домен или IPv4';
    } else if (!isValidHost(parsed.host)) {
      errors.serverIp =
        'IP: допустим домен (play.example.net) или IPv4 (1.2.3.4), без протокола и пробелов';
    }
    if (rawIp.includes(':')) {
      if (parsed.port === null) {
        errors.serverIp = 'IP: порт после «:» должен быть числом 1…65535';
      } else {
        portFromAddress = parsed.port;
      }
    }
  }

  const portRaw = raw.serverPort;
  let portFromField: number | null = null;
  if (portRaw !== null && portRaw !== '' && portRaw !== undefined) {
    const port = Number(portRaw);
    if (!Number.isFinite(port) || !Number.isInteger(port) || port < 1 || port > 65535) {
      errors.serverPort = 'Порт: целое число 1…65535 или пусто';
    } else {
      portFromField = port;
    }
  }

  serverPort = portFromAddress ?? portFromField;

  if (discordUrl && !isValidHttpUrl(discordUrl)) {
    errors.discordUrl = 'Discord: нужна ссылка вида https://discord.gg/...';
  }
  if (telegramUrl && !isValidHttpUrl(telegramUrl)) {
    errors.telegramUrl = 'Telegram: нужна ссылка вида https://t.me/...';
  }
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(supportEmail)) {
    errors.supportEmail = 'E-mail: некорректный адрес';
  }
  if (versions && !/\d+\.\d+/.test(versions)) {
    errors.versions = 'Версии: укажите диапазон, например 1.16.5 — 1.21.4';
  }

  const allowedStatuses: ServerStatus[] = ['online', 'offline', 'maintenance', 'soon'];
  let status: ServerStatus = DEFAULT_SETTINGS.status;
  if (allowedStatuses.includes(raw.status as ServerStatus)) {
    status = raw.status as ServerStatus;
  } else {
    errors.status = 'Статус: неизвестное значение';
  }

  const numOrNull = (key: 'onlinePlayers' | 'maxPlayers', label: string): number | null => {
    const value = raw[key];
    if (value === null || value === '' || value === undefined) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
      errors[key] = `${label}: целое число 0…1 000 000 или пусто`;
      return null;
    }
    return n;
  };

  const onlinePlayers = numOrNull('onlinePlayers', 'Онлайн');
  const maxPlayers = numOrNull('maxPlayers', 'Максимум игроков');

  if (onlinePlayers !== null && maxPlayers !== null && onlinePlayers > maxPlayers) {
    errors.onlinePlayers = 'Онлайн: не может быть больше максимума';
  }

  const storeOpen = raw.storeOpen === true || raw.storeOpen === 'true';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      brand,
      season,
      tagline,
      serverName,
      serverIp,
      serverPort,
      versions,
      javaRangeHint,
      discordUrl,
      telegramUrl,
      supportEmail,
      status,
      onlinePlayers,
      maxPlayers,
      storeOpen,
      storeClosedMessage,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    },
  };
}

/** Адрес для копирования в Minecraft: домен + порт, если порт нестандартный. */
export function connectAddress(settings: Pick<Settings, 'serverIp' | 'serverPort'>): string {
  if (!settings.serverPort || settings.serverPort === 25565) return settings.serverIp;
  return `${settings.serverIp}:${settings.serverPort}`;
}

/** Поля, которые показываются в журнале как «живые» (без служебных). */
export const EDITABLE_FIELDS: Array<keyof Settings> = [
  'serverIp',
  'serverPort',
  'serverName',
  'versions',
  'javaRangeHint',
  'status',
  'onlinePlayers',
  'maxPlayers',
  'brand',
  'season',
  'tagline',
  'discordUrl',
  'telegramUrl',
  'supportEmail',
  'storeOpen',
  'storeClosedMessage',
];
