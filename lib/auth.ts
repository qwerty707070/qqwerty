/**
 * Авторизация админки: пароль + необязательный TOTP (2FA),
 * подписанная httpOnly-кука сессии и лимит попыток входа.
 *
 * Замечания по безопасности, которые в исходной версии были нарушены:
 *  - пароль и код 2FA сравниваются за постоянное время (timingSafeEqual);
 *  - в куке лежит только подписанный идентификатор, без пароля;
 *  - количество попыток ограничено, чтобы 2FA нельзя было перебрать.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'kg_admin';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 часов

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? 'kinggrief';
}

export function isDefaultPassword(): boolean {
  return !process.env.ADMIN_PASSWORD;
}

function sessionSecret(): string {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  // Детерминированный фолбэк, чтобы dev-сессии не ломались при перезапуске.
  return createHmac('sha256', 'kinggrief-session-fallback').update(adminPassword()).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Сравниваем «пустоту» с хэшем, чтобы длина не утекала по времени ответа
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string): boolean {
  const expected = createHmac('sha256', 'kinggrief-password').update(adminPassword()).digest('hex');
  const actual = createHmac('sha256', 'kinggrief-password').update(candidate).digest('hex');
  return safeEqual(expected, actual);
}

/* ---------------------------- TOTP (RFC 6238) --------------------------- */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac('sha1', secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function totpEnabled(): boolean {
  return Boolean(process.env.ADMIN_TOTP_SECRET);
}

export function verifyTotp(token: string, at: number = Date.now()): boolean {
  const rawSecret = process.env.ADMIN_TOTP_SECRET;
  if (!rawSecret) return true; // 2FA не настроена
  const clean = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const secret = base32Decode(rawSecret);
  if (!secret.length) return false;
  const step = Math.floor(at / 1000 / 30);
  // окно ±1 шаг — компенсируем расхождение часов, но не даём широкий перебор
  for (const drift of [-1, 0, 1]) {
    if (safeEqual(hotp(secret, step + drift), clean)) return true;
  }
  return false;
}

/* ------------------------------- Сессии -------------------------------- */

type SessionPayload = { sub: 'admin'; exp: number; n: string };

function sign(data: string): string {
  return createHmac('sha256', sessionSecret()).update(data).digest('base64url');
}

export function createSessionToken(): string {
  const payload: SessionPayload = {
    sub: 'admin',
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    n: randomBytes(8).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [body, signature] = token.split('.');
  if (!body || !signature) return false;
  if (!safeEqual(sign(body), signature)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    return payload.sub === 'admin' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/** Проверка для server components / route handlers. */
export function isAdminRequest(): boolean {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

/**
 * Атрибуты куки сессии.
 *
 * ИСПРАВЛЕННЫЙ БАГ: раньше флаг `secure` включался просто по
 * NODE_ENV === 'production'. Если production-сборка открыта по HTTP
 * (локальный `next start`, preview-домен без TLS, IP-адрес), браузер
 * выбрасывает такую куку — вход «проходит», а сохранение отвечает 401
 * и форма молча выкидывает на /admin/login. Теперь `secure` включается
 * только когда запрос действительно пришёл по HTTPS.
 */
export function sessionCookieOptions(request?: Request) {
  const forwardedProto = request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = (request?.headers.get('host') ?? '').toLowerCase();
  const isLocalHost =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');

  const secure = forwardedProto
    ? forwardedProto === 'https'
    : process.env.NODE_ENV === 'production' && !isLocalHost;

  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    secure,
  };
}

/* --------------------------- Лимит попыток ----------------------------- */

const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function loginBlocked(ip: string): { blocked: boolean; retryAfterSec: number } {
  const entry = attempts.get(ip);
  if (!entry) return { blocked: false, retryAfterSec: 0 };
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(ip);
    return { blocked: false, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((WINDOW_MS - (Date.now() - entry.first)) / 1000),
    };
  }
  return { blocked: false, retryAfterSec: 0 };
}

export function registerFailedLogin(ip: string): void {
  const entry = attempts.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(ip: string): void {
  attempts.delete(ip);
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
