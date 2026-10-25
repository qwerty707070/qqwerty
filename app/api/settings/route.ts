import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { clientIp, isAdminRequest } from '@/lib/auth';
import { getSettings, saveSettings, settingsBackend } from '@/lib/settings-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

/** Публичное чтение настроек — источник для клиентской синхронизации. */
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(
    { settings, backend: settingsBackend },
    { headers: NO_STORE },
  );
}

/**
 * Сохранение из админки.
 * После записи обязательно:
 *  - revalidatePath('/', 'layout') — сбрасываем кэш всех страниц;
 *  - отдаём сохранённые настройки клиенту, чтобы форма и публичная
 *    страница показывали ровно то, что лежит в хранилище.
 */
export async function PUT(request: Request) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401, headers: NO_STORE });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400, headers: NO_STORE });
  }

  const ip = clientIp(request.headers);
  try {
    const result = await saveSettings(payload, 'admin', ip);

    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 422, headers: NO_STORE });
    }

    revalidatePath('/', 'layout');
    revalidatePath('/privileges');
    revalidatePath('/admin/design');

    return NextResponse.json(
      { settings: result.settings, changed: result.changed },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error('[api/settings] save failed:', error);
    return NextResponse.json(
      { error: 'Не удалось сохранить настройки. Проверьте хранилище (Supabase/диск).' },
      { status: 500, headers: NO_STORE },
    );
  }
}
