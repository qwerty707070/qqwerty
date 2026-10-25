'use client';

/**
 * Карточка адреса сервера.
 *
 * Здесь и был баг: значение приходило из пропсов и больше никогда не
 * обновлялось — «сохранено в админке, но на сайте старое».
 *
 * Что делает исправленная версия:
 *  1. получает начальное значение с сервера (SSR, никакой пустой вспышки);
 *  2. подтягивает свежие данные из /api/settings при монтировании,
 *     при возврате на вкладку (focus/visibilitychange) и раз в 15 секунд;
 *  3. слушает BroadcastChannel, поэтому изменение в соседней вкладке админки
 *     видно мгновенно;
 *  4. не показывает устаревшее значение как «актуальное»: внизу есть метка
 *     времени последней синхронизации.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '@/lib/settings';
import { STATUS_LABELS, connectAddress } from '@/lib/settings';

type Props = { initial: Settings };

const POLL_MS = 10_000;
const STALE_AFTER_MS = 30_000;

export function ServerAddressCard({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const versionRef = useRef(initial.updatedAt);

  const pull = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { settings: Settings };
      if (data.settings && data.settings.updatedAt !== versionRef.current) {
        versionRef.current = data.settings.updatedAt;
        setSettings(data.settings);
      }
      setLastSync(new Date());
      setSyncError(false);
    } catch {
      // сеть недоступна — оставляем последнее известное значение, но помечаем это
      setSyncError(true);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void pull();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void pull();
    }, POLL_MS);

    const onFocus = () => void pull();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    // bfcache: при возврате «Назад» браузер восстанавливает DOM как есть.
    // Без этого обработчика на странице остаётся старый IP.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void pull();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('kg-settings');
      channel.onmessage = () => void pull();
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
      channel?.close();
    };
  }, [pull]);

  const address = connectAddress(settings);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    window.setTimeout(() => setCopied('idle'), 2000);
  };

  const statusTone =
    settings.status === 'online'
      ? 'badge--green'
      : settings.status === 'maintenance'
        ? 'badge--gold'
        : settings.status === 'offline'
          ? 'badge--red'
          : '';

  return (
    <div className="address-card" id="connect">
      <div className="address-card__label">
        <span>IP сервера</span>
        <span className={`badge ${statusTone}`}>
          <span className="dot" />
          {STATUS_LABELS[settings.status]}
        </span>
      </div>

      <div className="address-card__ip">
        <span>{settings.serverIp}</span>
        {settings.serverPort && settings.serverPort !== 25565 ? (
          <span className="address-card__port">:{settings.serverPort}</span>
        ) : null}
      </div>

      <div className="address-card__actions">
        <button type="button" className="btn btn--primary" onClick={copy}>
          {copied === 'ok' ? 'Скопировано ✓' : copied === 'fail' ? 'Не удалось' : 'Копировать IP'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void pull()} disabled={syncing}>
          {syncing ? 'Обновляем…' : 'Обновить'}
        </button>
        <a
          className="btn btn--ghost"
          href={`https://minecraft-server.eu/server/${encodeURIComponent(settings.serverIp)}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Проверить статус
        </a>
      </div>

      <dl className="address-card__meta">
        <div>
          <dt>Версии</dt>
          <dd>{settings.versions}</dd>
        </div>
        <div>
          <dt>Онлайн</dt>
          <dd>
            {settings.onlinePlayers === null
              ? '—'
              : `${settings.onlinePlayers}${
                  settings.maxPlayers ? ` / ${settings.maxPlayers}` : ''
                }`}
          </dd>
        </div>
        <div>
          <dt>Название</dt>
          <dd>{settings.serverName}</dd>
        </div>
      </dl>

      <p className="sync-note">
        <span
          className="dot"
          style={{ color: syncing ? '#fbbf24' : syncError ? '#f87171' : '#4ade80' }}
        />
        {syncError
          ? 'нет связи с сервером — показано последнее полученное значение'
          : lastSync
            ? `данные синхронизированы в ${lastSync.toLocaleTimeString('ru-RU')}${
                Date.now() - lastSync.getTime() > STALE_AFTER_MS
                  ? ' (устарели, обновляем…)'
                  : ''
              }`
            : 'синхронизация с сервером…'}
      </p>
    </div>
  );
}
