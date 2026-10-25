import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/admin/LogoutButton';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { isAdminRequest, isDefaultPassword, totpEnabled } from '@/lib/auth';
import { getAudit, getSettings, settingsBackend } from '@/lib/settings-store';
import { STATUS_LABELS, connectAddress } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Дизайн и подключение · админка' };

export default async function AdminDesignPage() {
  if (!isAdminRequest()) redirect('/admin/login');

  const settings = await getSettings();
  const audit = await getAudit(8);

  return (
    <div className="container admin-shell">
      <nav className="admin-nav">
        <Link href="/admin/design" data-active="true">
          Дизайн и подключение
        </Link>
        <Link href="/privileges">Каталог привилегий ↗</Link>
        <Link href="/">Публичный сайт ↗</Link>
        <div style={{ marginTop: 10 }}>
          <LogoutButton />
        </div>
      </nav>

      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span className="eyebrow">Админ-панель</span>
            <h1 style={{ fontSize: 'clamp(26px, 3.6vw, 38px)' }}>Дизайн и подключение</h1>
            <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
              Всё, что вы сохраните здесь, сразу попадает в хранилище настроек и на публичные
              страницы. Хранилище:{' '}
              <code>{settingsBackend === 'supabase' ? 'Supabase (site_settings)' : '.data/settings.json'}</code>
              .
            </p>
          </div>
          <div className="preview-panel">
            <div className="address-card__label" style={{ marginBottom: 6 }}>
              <span>как видят игроки</span>
            </div>
            <code style={{ fontSize: 18 }}>{connectAddress(settings)}</code>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {STATUS_LABELS[settings.status]} · обновлено{' '}
              {new Date(settings.updatedAt).toLocaleString('ru-RU')}
            </div>
          </div>
        </div>

        {isDefaultPassword() ? (
          <div className="alert alert--warn">
            Используется пароль по умолчанию. Задайте <code>ADMIN_PASSWORD</code> и
            {totpEnabled() ? '' : ' <code>ADMIN_TOTP_SECRET</code>'} перед публикацией.
          </div>
        ) : null}

        <SettingsForm initial={settings} />

        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 6 }}>Журнал изменений</h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
            Кто, когда и с какого IP менял настройки, и какие поля изменились.
          </p>

          {audit.length === 0 ? (
            <p className="muted">Изменений пока не было.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>IP</th>
                    <th>Поля</th>
                    <th>Было → стало</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((entry) => (
                    <tr key={`${entry.at}-${entry.ip}`}>
                      <td>{new Date(entry.at).toLocaleString('ru-RU')}</td>
                      <td>
                        <code>{entry.ip}</code>
                      </td>
                      <td>{entry.changed.join(', ') || '—'}</td>
                      <td style={{ maxWidth: 420 }}>
                        {entry.changed.map((field) => (
                          <div key={field} style={{ fontSize: 12 }}>
                            <strong>{field}</strong>:{' '}
                            <span className="muted">
                              {JSON.stringify((entry.before as Record<string, unknown>)[field])} →{' '}
                            </span>
                            {JSON.stringify((entry.after as Record<string, unknown>)[field])}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
