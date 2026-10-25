'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoginForm({ totp }: { totp: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Не удалось войти');
        return;
      }
      router.replace('/admin/design');
      router.refresh();
    } catch {
      setError('Сеть недоступна, попробуйте ещё раз');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="password">Пароль</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {totp ? (
        <div className="field">
          <label htmlFor="code">Код 2FA</label>
          <input
            id="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          <span className="field__hint">6 цифр из приложения-аутентификатора</span>
        </div>
      ) : null}

      {error ? <div className="alert">{error}</div> : null}

      <button type="submit" className="btn btn--primary" disabled={pending}>
        {pending ? 'Проверяем…' : 'Войти в панель'}
      </button>
    </form>
  );
}
