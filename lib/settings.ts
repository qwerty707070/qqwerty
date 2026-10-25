/**
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ ДЛЯ НАСТРОЕК САЙТА.
 *
 * Главный баг, который здесь исправлен:
 * раньше IP сервера (и другие поля) были захардкожены в каждом компоненте
 * отдельно, а админка писала в свой стор (localStorage / провайдер другого
 * дерева компонентов). В итоге публичная страница продолжала показывать
 * значение из бандла.
 *
 * Правило, которое теперь соблюдается:
 * ни один компонент НЕ хранит собственное значение IP/ссылок/версий.
 * Всё берётся из getSettings() на сервере или из /api/settings на клиенте.
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

/* ------------------------------------------------------------------ */
/* Валидация: админка не должна уметь сохранить «сломанный» IP         */
/* ------------------------------------------------------------------ */

const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))*$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function isValidHost(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (IPV4_RE.test(v)) {
    return v.split('.').every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === part.replace(/^0(?=\d)/, '');
    });
  }
  if (v.includes('://') || v.includes('/') || v.includes(' ')) return false;
  return HOSTNAME_RE.test(v);
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export type ValidationResult =
  | { ok: true; value: Settings }
  | { ok: false; errors: Record<string, string> };

/**
 * Принимает произвольный JSON из админки, возвращает нормализованные настройки
 * или список ошибок по полям. Никаких «тихих» значений по умолчанию:
 * если поле пришло битым — форма покажет ошибку, а не сохранит мусор.
 */
export function validateSettings(input: unknown, actor: string): ValidationResult {
  const errors: Record<string, string> = {};
  const raw = (input ?? {}) as Record<string, unknown>;

  const str = (key: keyof Settings, max: number): string => {
    const value = raw[key];
    if (typeof value !== 'string') {
      errors[key] = 'Ожидается текст';
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      errors[key] = 'Не может быть пустым';
      return '';
    }
    if (trimmed.length > max) {
      errors[key] = `Максимум ${max} символов`;
      return '';
    }
    return trimmed;
  };

  const brand = str('brand', 32);
  const season = str('season', 80);
  const tagline = str('tagline', 120);
  const serverName = str('serverName', 48);
  const serverIp = str('serverIp', 253);
  const versions = str('versions', 48);
  const javaRangeHint = str('javaRangeHint', 80);
  const discordUrl = str('discordUrl', 200);
  const telegramUrl = str('telegramUrl', 200);
  const supportEmail = str('supportEmail', 120);
  const storeClosedMessage = str('storeClosedMessage', 200);

  if (serverIp && !isValidHost(serverIp)) {
    errors.serverIp = 'Некорректный IP или домен: допустимо play.example.net или 12.34.56.78';
  }
  if (discordUrl && !isValidHttpUrl(discordUrl)) {
    errors.discordUrl = 'Нужна ссылка вида https://discord.gg/...';
  }
  if (telegramUrl && !isValidHttpUrl(telegramUrl)) {
    errors.telegramUrl = 'Нужна ссылка вида https://t.me/...';
  }
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(supportEmail)) {
    errors.supportEmail = 'Некорректный e-mail';
  }
  if (versions && !/\d+\.\d+/.test(versions)) {
    errors.versions = 'Укажите диапазон версий, например 1.16.5 — 1.21.4';
  }

  const portRaw = raw.serverPort;
  let serverPort: number | null = null;
  if (portRaw === null || portRaw === '' || portRaw === undefined) {
    serverPort = null; // null = порт по умолчанию 25565, в адресе не печатаем
  } else {
    const port = Number(portRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.serverPort = 'Порт — целое число 1…65535 или пусто';
    } else {
      serverPort = port;
    }
  }

  const statusRaw = raw.status;
  const allowedStatuses: ServerStatus[] = ['online', 'offline', 'maintenance', 'soon'];
  const status = allowedStatuses.includes(statusRaw as ServerStatus)
    ? (statusRaw as ServerStatus)
    : (() => {
        errors.status = 'Неизвестный статус';
        return DEFAULT_SETTINGS.status;
      })();

  const numOrNull = (key: 'onlinePlayers' | 'maxPlayers', max: number): number | null => {
    const value = raw[key];
    if (value === null || value === '' || value === undefined) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > max) {
      errors[key] = `Число от 0 до ${max} или пусто`;
      return null;
    }
    return n;
  };

  const onlinePlayers = numOrNull('onlinePlayers', 1_000_000);
  const maxPlayers = numOrNull('maxPlayers', 1_000_000);

  if (onlinePlayers !== null && maxPlayers !== null && onlinePlayers > maxPlayers) {
    errors.onlinePlayers = 'Онлайн не может быть больше максимума';
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
export function connectAddress(settings: Settings): string {
  if (!settings.serverPort || settings.serverPort === 25565) return settings.serverIp;
  return `${settings.serverIp}:${settings.serverPort}`;
}

export const STATUS_LABELS: Record<ServerStatus, string> = {
  online: 'Сервер онлайн',
  offline: 'Сервер офлайн',
  maintenance: 'Технические работы',
  soon: 'Статус уточняется',
};
