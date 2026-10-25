'use client';

/**
 * Самодиагностика хранилища прямо в админке.
 *
 * Появилась из-за главной жалобы «сохранение не работает»: раньше
 * единственным симптомом был общий 500 или молчаливый редирект на логин.
 * Теперь видно, куда пишутся настройки, доступна ли запись и проходит ли
 * полный круг «запись → чтение».
 */
import { useCallback, useEffect, useState } from 'react';

type Health = {
  backend: 'supabase' | 'file';
  location: string;
  writable: boolean;
  degraded: boolean;
  hint?: string;
};

type VerifyResult = {
  ok: boolean;
  backend: string;
  location: string;
  roundTripMs: number;
  error?: string;
  hint?: string;
};

export function StorageDiagnostics({ initialHealth }: { initialHealth: Health }) {
  const [health, setHealth] = useState<Health>(initialHealth);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/verify', { cache: 'no-store' });
      if (res.status === 401) {
        setError('Сессия истекла — обновите страницу и войдите заново');
        return;
      }
      const data = (await res.json()) as { health?: Health };
      if (data.health) setHealth(data.health);
      setError(null);
    } catch {
      setError('Не удалось получить статус хранилища');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const verify = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch('/api/settings/verify', { method: 'POST', cache: 'no-store' });
      const data = (await res.json()) as VerifyResult;
      setResult(data);
      void refresh();
    } catch {
      setResult({
        ok: false,
        backend: health.backend,
        location: health.location,
        roundTripMs: 0,
        error: 'Запрос не дошёл до сервера',
      });
    } finally {
      setChecking(false);
    }
  };

  const tone = health.writable ? (health.degraded ? 'warn' : 'ok') : 'error';

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 20 }}>Хранилище настроек</h2>
        <span
          className="badge"
          style={{
            borderColor:
              tone === 'ok'
                ? 'rgba(74,222,128,0.45)'
                : tone === 'warn'
                  ? 'rgba(251,191,36,0.45)'
                  : 'rgba(248,113,113,0.45)',
            color: tone === 'ok' ? 'var(--green)' : tone === 'warn' ? 'var(--gold)' : 'var(--red)',
          }}
        >
          <span className="dot" />
          {tone === 'ok' ? 'запись доступна' : tone === 'warn' ? 'ограниченный режим' : 'запись недоступна'}
        </span>
      </div>

      <dl className="address-card__meta" style={{ marginTop: 14 }}>
        <div>
          <dt>Бэкенд</dt>
          <dd>{health.backend === 'supabase' ? 'Supabase' : 'Файл'}</dd>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <dt>Расположение</dt>
          <dd style={{ wordBreak: 'break-all' }}>
            <code>{health.location}</code>
          </dd>
        </div>
      </dl>

      {health.hint ? (
        <div className="alert alert--warn" style={{ marginTop: 14 }}>
          {health.hint}
        </div>
      ) : null}

      {error ? <div className="alert" style={{ marginTop: 14 }}>{error}</div> : null}

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={verify} disabled={checking}>
          {checking ? 'Проверяем запись…' : 'Проверить сохранение'}
        </button>
        {result ? (
          <span className="save-state" data-tone={result.ok ? 'ok' : 'error'}>
            {result.ok
              ? `круг «запись → чтение» пройден за ${result.roundTripMs} мс`
              : `сбой: ${result.error ?? 'неизвестная ошибка'}`}
          </span>
        ) : null}
      </div>

      {result && !result.ok && result.hint ? (
        <div className="alert" style={{ marginTop: 12 }}>
          Что делать: {result.hint}
        </div>
      ) : null}
    </div>
  );
}
