import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest, isDefaultPassword, totpEnabled } from '@/lib/auth';
import { getSettingsStrict, isServerless, storageHealth, verifyStorage } from '@/lib/settings-store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Диагностика · админка' };

type Check = {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  fix?: string;
};

export default async function DiagnosePage() {
  if (!isAdminRequest()) redirect('/admin/login');

  const [health, loaded] = await Promise.all([storageHealth(), getSettingsStrict()]);
  const roundTrip = await verifyStorage();
  const serverless = isServerless();

  const checks: Check[] = [
    {
      name: 'Хранилище настроек доступно',
      status: loaded.ok ? (health.writable ? 'ok' : 'fail') : 'fail',
      detail: loaded.ok
        ? `${health.backend === 'supabase' ? 'Supabase' : 'файл'}: ${health.location}`
        : loaded.error.message,
      fix: loaded.ok ? undefined : loaded.error.hint,
    },
    {
      name: 'Круг «запись → чтение»',
      status: roundTrip.ok ? 'ok' : 'fail',
      detail: roundTrip.ok
        ? `пройден за ${roundTrip.roundTripMs} мс`
        : `${roundTrip.error ?? 'ошибка'}${roundTrip.hint ? ` — ${roundTrip.hint}` : ''}`,
      fix: roundTrip.ok ? undefined : roundTrip.hint,
    },
    {
      name: 'Настройки постоянные (переживут перезапуск и видны всем инстансам)',
      status: health.durable ? 'ok' : 'fail',
      detail: health.durable
        ? 'да: данные в постоянном хранилище'
        : `нет: ${serverless ? 'serverless-окружение' : 'временный файл'}, запись живёт только в одном инстансе`,
      fix: health.durable
        ? undefined
        : 'Задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (service_role) и выполните supabase/schema.sql. Без этого сохранение будет «откатываться»: именно так выглядит жалоба «поменял IP, а он вернулся».',
    },
    {
      name: 'Пароль администратора изменён',
      status: isDefaultPassword() ? 'fail' : 'ok',
      detail: isDefaultPassword() ? 'используется пароль по умолчанию «kinggrief»' : 'задан через ADMIN_PASSWORD',
      fix: isDefaultPassword() ? 'Задайте ADMIN_PASSWORD в переменных окружения.' : undefined,
    },
    {
      name: 'Двухфакторная аутентификация',
      status: totpEnabled() ? 'ok' : 'warn',
      detail: totpEnabled() ? 'включена (ADMIN_TOTP_SECRET)' : 'выключена',
      fix: totpEnabled() ? undefined : 'Необязательно, но рекомендуется: задайте ADMIN_TOTP_SECRET (base32).',
    },
    {
      name: 'Публичные страницы читают хранилище на каждый запрос',
      status: 'ok',
      detail: 'страницы объявлены force-dynamic, /api/settings отдаётся с Cache-Control: no-store',
    },
  ];

  const failures = checks.filter((check) => check.status === 'fail');
  const warnings = checks.filter((check) => check.status === 'warn');

  const verdict =
    failures.length > 0
      ? 'Сохранение настроек работать не будет'
      : warnings.length > 0
        ? 'Работает, есть замечания'
        : 'Всё в порядке: сохранение применяется сразу';

  return (
    <div className="container admin-shell">
      <nav className="admin-nav">
        <Link href="/admin/design">Дизайн и подключение</Link>
        <Link href="/admin/diagnose" data-active="true">
          Диагностика
        </Link>
        <Link href="/">Публичный сайт ↗</Link>
      </nav>

      <div className="stack">
        <div>
          <span className="eyebrow">Проверка окружения</span>
          <h1 style={{ fontSize: 'clamp(26px, 3.6vw, 38px)' }}>Диагностика</h1>
          <p className="muted" style={{ marginTop: 8, maxWidth: 680 }}>
            Если правка в админке «не доезжает» до сайта или откатывается обратно — эта страница
            показывает, на каком именно шаге рвётся.
          </p>
        </div>

        <div
          className="card"
          style={{
            borderColor: failures.length ? 'rgba(248,113,113,0.5)' : 'rgba(74,222,128,0.45)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 22 }}>{verdict}</h2>
            <span className="badge">
              {health.backend === 'supabase' ? 'Supabase' : 'файл'} ·{' '}
              {health.durable ? 'постоянное' : 'непостоянное'}
            </span>
          </div>

          <div className="stack" style={{ marginTop: 18, gap: 12 }}>
            {checks.map((check) => (
              <div
                key={check.name}
                style={{
                  borderLeft: `3px solid ${
                    check.status === 'ok'
                      ? 'var(--green)'
                      : check.status === 'warn'
                        ? 'var(--gold)'
                        : 'var(--red)'
                  }`,
                  paddingLeft: 14,
                }}
              >
                <div className="row" style={{ gap: 8 }}>
                  <strong>{check.name}</strong>
                  <span
                    className="badge"
                    style={{
                      color:
                        check.status === 'ok'
                          ? 'var(--green)'
                          : check.status === 'warn'
                            ? 'var(--gold)'
                            : 'var(--red)',
                    }}
                  >
                    {check.status === 'ok' ? 'ок' : check.status === 'warn' ? 'внимание' : 'проблема'}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {check.detail}
                </div>
                {check.fix ? (
                  <div style={{ fontSize: 13, marginTop: 4 }}>Что делать: {check.fix}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 18 }}>Если сайт всё равно показывает старый IP</h2>
          <ol className="muted" style={{ fontSize: 14, margin: '10px 0 0', paddingLeft: 20 }}>
            <li>
              Откройте сайт в другом браузере или в инкогнито. Если там новый IP — проблема была
              только в кэше вашего браузера.
            </li>
            <li>
              Проверьте, что сохранение не «откатывается»: сохраните IP, обновите страницу админки
              через 30 секунд. Если значение вернулось — это непостоянное хранилище (пункт 3 выше).
            </li>
            <li>
              Откройте <code>/api/settings</code> — там должен быть ваш новый IP. Если да, а на
              странице старое, значит HTML закэширован на CDN.
            </li>
            <li>
              Убедитесь, что деплой обновлён: старый инстанс продолжает отдавать старый код и старое
              значение из своей памяти.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
