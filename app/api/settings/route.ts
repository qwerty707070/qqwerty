import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { clientIp, isAdminRequest } from '@/lib/auth';
import {
  StorageError,
  getSettings,
  saveSettings,
  settingsBackend,
  storageHealth,
} from '@/lib/settings-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Публичное чтение настроек — источник для клиентской синхронизации. */
export async function GET() {
  const settings = await getSettings();
  const health = await storageHealth();
  return json({
    settings,
    backend: settingsBackend,
    // Диагностика нужна админке, но не раскрывает ничего секретного
    storage: {
      writable: health.writable,
      degraded: health.degraded,
      durable: health.durable,
      serverless: health.serverless,
    },
  });
}

/**
 * Сохранение из админки.
 *
 * ИСПРАВЛЕННЫЕ БАГИ:
 *  1. принимается частичный payload (раньше PUT только с одним полем падал
 *     с «Ожидается текст» на всех остальных полях);
 *  2. возвращается понятная причина сбоя хранилища (code + hint) вместо
 *     общего «Не удалось сохранить настройки»;
 *  3. оптимистическая блокировка: если настройки изменил кто-то ещё,
 *     ответ 409 с актуальной версией, а не тихая перезапись.
 */
export async function PUT(request: Request) {
  if (!isAdminRequest()) {
    return json({ error: 'Требуется авторизация', code: 'UNAUTHORIZED' }, 401);
  }

  let payload: unknown = {};
  try {
    const text = await request.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return json({ error: 'Некорректный JSON в теле запроса', code: 'BAD_JSON' }, 400);
  }

  const body = payload as { version?: unknown; force?: unknown; strict?: unknown };
  const expectedVersion = typeof body.version === 'string' ? body.version : undefined;
  const force = body.force === true;
  const strict = body.strict === true;

  try {
    const result = await saveSettings(payload, 'admin', clientIp(request.headers), {
      expectedVersion,
      force,
      strict,
    });

    if ('conflict' in result) {
      return json(
        {
          error: 'Настройки уже изменены в другой вкладке или другим администратором',
          code: 'VERSION_CONFLICT',
          current: result.current,
        },
        409,
      );
    }

    if (!result.ok) {
      return json({ errors: result.errors, code: 'VALIDATION' }, 422);
    }

    if (result.changed.length > 0) {
      revalidatePath('/', 'layout');
      revalidatePath('/privileges');
      revalidatePath('/cases');
      revalidatePath('/relics');
      revalidatePath('/checkout');
      revalidatePath('/admin/design');
    }

    const warnings: string[] = [];
    if (!result.durable) warnings.push('NON_DURABLE_STORAGE');
    if (result.conflictResolved) warnings.push('VERSION_CONFLICT_RESOLVED');

    return json({
      settings: result.settings,
      changed: result.changed,
      durable: result.durable,
      warnings,
    });
  } catch (error) {
    const storageError =
      error instanceof StorageError
        ? error
        : new StorageError(
            error instanceof Error ? error.message : String(error),
            'WRITE_FAILED',
            'Проверьте хранилище настроек.',
          );

    console.error('[api/settings] сохранение не удалось:', storageError);
    return json(
      {
        error: 'Не удалось сохранить настройки',
        code: storageError.code,
        detail: storageError.message,
        hint: storageError.hint,
      },
      500,
    );
  }
}
