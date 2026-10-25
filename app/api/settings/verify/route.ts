import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { storageHealth, verifyStorage } from '@/lib/settings-store';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Самодиагностика хранилища: где лежат настройки, можно ли писать,
 * проходит ли полный круг «запись → чтение». Нужна, чтобы проблема
 * «сохранение не работает» показывала причину, а не 500 без деталей.
 */
export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401, headers: NO_STORE });
  }
  const health = await storageHealth();
  return NextResponse.json({ health }, { headers: NO_STORE });
}

export async function POST() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401, headers: NO_STORE });
  }
  const result = await verifyStorage();
  return NextResponse.json(result, { status: result.ok ? 200 : 500, headers: NO_STORE });
}
