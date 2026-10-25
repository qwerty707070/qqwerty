import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { isAdminRequest, isDefaultPassword, totpEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Вход в админ-панель' };

export default function LoginPage() {
  if (isAdminRequest()) redirect('/admin/design');

  return (
    <div className="container login-wrap">
      <div className="login-card">
        <span className="badge badge--gold">
          <span className="dot" /> protected area
        </span>
        <h1 style={{ marginTop: 14 }}>Вход в панель</h1>
        <p className="muted" style={{ fontSize: 14 }}>
          Доступ только для администрации. Попытки входа ограничены: 5 попыток за 10 минут на IP.
        </p>

        {isDefaultPassword() ? (
          <div className="alert alert--warn" style={{ marginTop: 16 }}>
            Пароль по умолчанию <code>kinggrief</code>. Задайте <code>ADMIN_PASSWORD</code> в
            переменных окружения перед публикацией.
          </div>
        ) : null}

        <LoginForm totp={totpEnabled()} />
      </div>
    </div>
  );
}
