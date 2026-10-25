import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  checkPassword,
  clearLoginAttempts,
  clientIp,
  createSessionToken,
  loginBlocked,
  registerFailedLogin,
  sessionCookieOptions,
  totpEnabled,
  verifyTotp,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const limit = loginBlocked(ip);
  if (limit.blocked) {
    return NextResponse.json(
      { error: `Слишком много попыток. Повторите через ${limit.retryAfterSec} с.` },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    password?: string;
    code?: string;
  };

  const password = typeof body.password === 'string' ? body.password : '';
  const code = typeof body.code === 'string' ? body.code : '';

  if (!checkPassword(password)) {
    registerFailedLogin(ip);
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
  }

  if (totpEnabled() && !verifyTotp(code)) {
    registerFailedLogin(ip);
    return NextResponse.json(
      { error: 'Неверный или просроченный код 2FA' },
      { status: 401 },
    );
  }

  clearLoginAttempts(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
  return response;
}
