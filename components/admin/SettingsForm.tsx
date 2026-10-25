'use client';

/**
 * Форма настроек админки.
 *
 * ИСПРАВЛЕННЫЕ БАГИ:
 *  1. числовые поля хранятся строками — раньше `Number('')`/`Number('12a')`
 *     давали NaN, поле «залипало» и форма отправляла мусор;
 *  2. ошибка хранилища больше не выглядит как «ничего не произошло»:
 *     показываются code, detail и hint (например «выполните supabase/schema.sql»);
 *  3. конфликт версий (409) не перетирает чужие правки: предлагается
 *     загрузить свежие или осознанно перезаписать;
 *  4. после успешного сохранения форма берёт данные из ОТВЕТА сервера,
 *     а не из локального состояния.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  STATUS_LABELS,
  type ServerStatus,
  type Settings,
  connectAddress,
  isValidHost,
  splitHostPort,
} from '@/lib/settings';

type Props = {
  initial: Settings;
  /** false — хранилище не переживёт перезапуск (serverless/временный файл). */
  durable?: boolean;
};

type NumericKey = 'serverPort' | 'onlinePlayers' | 'maxPlayers';

type SaveError = {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
};

const toNumeric = (value: number | null): string => (value === null ? '' : String(value));

export function SettingsForm({ initial, durable = true }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<Settings>(initial);
  const [numeric, setNumeric] = useState<Record<NumericKey, string>>({
    serverPort: toNumeric(initial.serverPort),
    onlinePlayers: toNumeric(initial.onlinePlayers),
    maxPlayers: toNumeric(initial.maxPlayers),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [conflict, setConflict] = useState<{ current: Settings; payload: unknown } | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'ok' | 'warn'>('ok');
  const [durabilityWarning, setDurabilityWarning] = useState(!durable);
  const [remoteNewer, setRemoteNewer] = useState<Settings | null>(null);

  // Версия, которую форма считает «своей». Нужна, чтобы отличить
  // собственную перерисовку от чужой правки и не стирать черновик.
  const seenVersion = useRef(initial.updatedAt);

  const applySettings = useCallback((next: Settings) => {
    setForm(next);
    setNumeric({
      serverPort: toNumeric(next.serverPort),
      onlinePlayers: toNumeric(next.onlinePlayers),
      maxPlayers: toNumeric(next.maxPlayers),
    });
    seenVersion.current = next.updatedAt;
  }, []);

  const portNumber = numeric.serverPort.trim() === '' ? null : Number(numeric.serverPort);
  const previewAddress = useMemo(() => {
    const parsed = splitHostPort(form.serverIp);
    const port = numeric.serverPort.trim() === '' ? parsed.port : portNumber;
    return connectAddress({ serverIp: parsed.host, serverPort: Number.isFinite(port) ? port : null });
  }, [form.serverIp, numeric.serverPort, portNumber]);

  const dirtyFields = useMemo(() => {
    const changed: string[] = [];
    for (const key of Object.keys(form) as Array<keyof Settings>) {
      if (key === 'updatedAt' || key === 'updatedBy') continue;
      if (JSON.stringify(form[key]) !== JSON.stringify(initial[key])) changed.push(key);
    }
    for (const key of Object.keys(numeric) as NumericKey[]) {
      if (numeric[key] !== toNumeric(initial[key])) changed.push(key);
    }
    return changed;
  }, [form, numeric, initial]);

  /**
   * Сервер прислал новую версию (другая вкладка/администратор или наш же
   * router.refresh). Если черновика нет — просто подхватываем её. Если есть —
   * показываем предложение загрузить, чтобы не потерять введённое.
   */
  useEffect(() => {
    if (initial.updatedAt === seenVersion.current) return;
    if (dirtyFields.length === 0) {
      applySettings(initial);
      setRemoteNewer(null);
    } else {
      setRemoteNewer(initial);
    }
  }, [initial, dirtyFields.length, applySettings]);

  /** Подтянуть актуальные настройки с сервера по кнопке. */
  const refreshFromServer = useCallback(async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { settings: Settings };
      if (data.settings) {
        applySettings(data.settings);
        setRemoteNewer(null);
        setErrors({});
        setState('idle');
        setMessage('Загружена версия с сервера');
      }
    } catch {
      setMessage('Не удалось получить настройки с сервера');
    }
  }, [applySettings]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
    setSaveError(null);
    setState('idle');
  };

  const updateNumeric = (key: NumericKey, value: string) => {
    // оставляем только цифры: NaN и «12a» в состояние не попадают
    const clean = value.replace(/[^\d]/g, '');
    setNumeric((prev) => ({ ...prev, [key]: clean }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSaveError(null);
    setState('idle');
  };

  const buildPayload = () => ({
    ...form,
    serverPort: numeric.serverPort.trim() === '' ? null : portNumber,
    onlinePlayers: numeric.onlinePlayers.trim() === '' ? null : Number(numeric.onlinePlayers),
    maxPlayers: numeric.maxPlayers.trim() === '' ? null : Number(numeric.maxPlayers),
  });

  const submit = async (options: { force?: boolean; version?: string; retried?: boolean } = {}) => {
    setState('saving');
    setMessage('');
    setErrors({});
    setSaveError(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildPayload(),
          // версия, которую видел админ — защита от тихой перезаписи
          version: options.version ?? form.updatedAt,
          force: options.force === true,
        }),
      });

      if (res.status === 401) {
        setState('error');
        setSaveError({
          message: 'Сессия истекла',
          hint: 'Войдите в панель заново — черновик формы останется в этой вкладке.',
        });
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        settings?: Settings;
        errors?: Record<string, string>;
        error?: string;
        code?: string;
        detail?: string;
        hint?: string;
        changed?: string[];
        current?: Settings;
        warnings?: string[];
        durable?: boolean;
      };

      if (res.status === 409 && data.current) {
        // Строгий режим: не блокируем пользователя, а сразу применяем его
        // значения поверх свежей версии — иначе правка «исчезает».
        if (!options.retried) {
          setRemoteNewer(data.current);
          await submit({ force: true, version: data.current.updatedAt, retried: true });
          return;
        }
        setConflict({ current: data.current, payload: buildPayload() });
        setState('error');
        setMessage('Обнаружен конфликт версий');
        return;
      }

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
          setState('error');
          setMessage('Проверьте подсвеченные поля');
        } else {
          setState('error');
          setMessage(data.error ?? 'Не удалось сохранить');
          setSaveError({
            message: data.error ?? 'Не удалось сохранить',
            code: data.code,
            detail: data.detail,
            hint: data.hint,
          });
        }
        return;
      }

      if (data.settings) applySettings(data.settings);

      const warnings = data.warnings ?? [];
      const notDurable = warnings.includes('NON_DURABLE_STORAGE') || data.durable === false;
      const conflictResolved = warnings.includes('VERSION_CONFLICT_RESOLVED');

      setDurabilityWarning(notDurable);
      setConflict(null);
      setState('saved');
      setMessage(
        data.changed && data.changed.length
          ? `Сохранено: ${data.changed.join(', ')}`
          : 'Изменений нет — значения совпадают',
      );

      if (notDurable) {
        setToastTone('warn');
        setToast('Сохранено только в этом инстансе: хранилище не постоянное (см. предупреждение)');
      } else if (conflictResolved) {
        setToastTone('warn');
        setToast('Кто-то ещё менял настройки — ваши значения применены поверх');
      } else {
        setToastTone('ok');
        setToast('Настройки сохранены — публичные страницы обновлены');
      }

      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel('kg-settings').postMessage({ type: 'settings-updated' });
      }
      router.refresh();
      window.setTimeout(() => setToast(null), 3200);
    } catch {
      setState('error');
      setMessage('Сеть недоступна — изменения не сохранены');
      setSaveError({
        message: 'Запрос не дошёл до сервера',
        hint: 'Проверьте соединение и повторите сохранение.',
      });
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const resetToInitial = () => {
    setForm(initial);
    setNumeric({
      serverPort: toNumeric(initial.serverPort),
      onlinePlayers: toNumeric(initial.onlinePlayers),
      maxPlayers: toNumeric(initial.maxPlayers),
    });
    setErrors({});
    setSaveError(null);
    setConflict(null);
    setRemoteNewer(null);
    setState('idle');
    setMessage('');
  };

  const addressWarning = (() => {
    const parsed = splitHostPort(form.serverIp);
    if (!form.serverIp.trim()) return 'Адрес не заполнен';
    if (!isValidHost(parsed.host)) return 'Похоже на опечатку: нужен домен или IPv4 без протокола';
    return null;
  })();

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Подключение к серверу</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
        Значение читается хранилищем на каждый запрос, поэтому сохраняется и на сайте, и в админке
        одновременно.
      </p>

      {durabilityWarning ? (
        <div className="alert" style={{ marginBottom: 18 }}>
          <strong>Сохранение не постоянное.</strong> Настройки записываются в хранилище, которое
          живёт только внутри одного инстанса (serverless / временный файл). Внешне это выглядит так:
          сохранили IP — через минуту он «откатился» обратно.
          <div style={{ marginTop: 6 }}>
            Решение: задайте <code>SUPABASE_URL</code> и <code>SUPABASE_SERVICE_ROLE_KEY</code> и
            выполните <code>supabase/schema.sql</code>, либо разместите проект на сервере с
            постоянным диском. Проверить текущее состояние — блок «Хранилище настроек» ниже.
          </div>
        </div>
      ) : null}

      {remoteNewer ? (
        <div className="alert alert--warn" style={{ marginBottom: 18 }}>
          <strong>На сервере более новая версия настроек.</strong> Ваши правки в форме сохранены как
          черновик и не потеряны.
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={refreshFromServer}>
              Загрузить с сервера
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              в любом случае при сохранении применится то, что введено в форме
            </span>
          </div>
        </div>
      ) : null}

      {saveError ? (
        <div className="alert" style={{ marginBottom: 18 }}>
          <strong>{saveError.message}</strong>
          {saveError.code ? (
            <div style={{ marginTop: 4 }}>
              код: <code>{saveError.code}</code>
            </div>
          ) : null}
          {saveError.detail ? (
            <div style={{ marginTop: 4, opacity: 0.85 }}>{saveError.detail}</div>
          ) : null}
          {saveError.hint ? <div style={{ marginTop: 6 }}>Что делать: {saveError.hint}</div> : null}
        </div>
      ) : null}

      {conflict ? (
        <div className="alert alert--warn" style={{ marginBottom: 18 }}>
          <strong>Настройки уже изменены в другой вкладке или другим администратором.</strong>
          <div style={{ marginTop: 4 }}>
            Актуальная версия: <code>{new Date(conflict.current.updatedAt).toLocaleString('ru-RU')}</code>, IP{' '}
            <code>{connectAddress(conflict.current)}</code>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                const current = conflict.current;
                setForm(current);
                setNumeric({
                  serverPort: toNumeric(current.serverPort),
                  onlinePlayers: toNumeric(current.onlinePlayers),
                  maxPlayers: toNumeric(current.maxPlayers),
                });
                setConflict(null);
                setState('idle');
                setMessage('Загружена актуальная версия');
              }}
            >
              Загрузить свежие
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                const current = conflict.current;
                setConflict(null);
                void submit({ force: true, version: current.updatedAt });
              }}
            >
              Перезаписать моими
            </button>
          </div>
        </div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="serverIp">IP / домен сервера</label>
          <input
            id="serverIp"
            value={form.serverIp}
            onChange={(event) => update('serverIp', event.target.value)}
            placeholder="play.example.net или play.example.net:25565"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.serverIp ? 'true' : undefined}
          />
          {errors.serverIp ? <span className="field__error">{errors.serverIp}</span> : null}
          {!errors.serverIp && addressWarning ? (
            <span className="field__hint" style={{ color: 'var(--gold)' }}>
              {addressWarning}
            </span>
          ) : (
            <span className="field__hint">
              Домен или IPv4. Порт можно вписать сразу: <code>host:25565</code>.
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="serverPort">Порт</label>
          <input
            id="serverPort"
            inputMode="numeric"
            value={numeric.serverPort}
            onChange={(event) => updateNumeric('serverPort', event.target.value)}
            placeholder="25565"
            aria-invalid={errors.serverPort ? 'true' : undefined}
          />
          {errors.serverPort ? <span className="field__error">{errors.serverPort}</span> : null}
          <span className="field__hint">Пусто или 25565 — порт на сайте не печатается.</span>
        </div>

        <div className="field">
          <label htmlFor="serverName">Название сервера</label>
          <input
            id="serverName"
            value={form.serverName}
            onChange={(event) => update('serverName', event.target.value)}
            aria-invalid={errors.serverName ? 'true' : undefined}
          />
          {errors.serverName ? <span className="field__error">{errors.serverName}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="versions">Поддерживаемые версии</label>
          <input
            id="versions"
            value={form.versions}
            onChange={(event) => update('versions', event.target.value)}
            placeholder="1.16.5 — 1.21.4"
            aria-invalid={errors.versions ? 'true' : undefined}
          />
          {errors.versions ? <span className="field__error">{errors.versions}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="status">Статус сервера</label>
          <select
            id="status"
            value={form.status}
            onChange={(event) => update('status', event.target.value as ServerStatus)}
            aria-invalid={errors.status ? 'true' : undefined}
          >
            {(Object.keys(STATUS_LABELS) as ServerStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          {errors.status ? <span className="field__error">{errors.status}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="onlinePlayers">Онлайн (игроков)</label>
          <input
            id="onlinePlayers"
            inputMode="numeric"
            value={numeric.onlinePlayers}
            onChange={(event) => updateNumeric('onlinePlayers', event.target.value)}
            placeholder="—"
            aria-invalid={errors.onlinePlayers ? 'true' : undefined}
          />
          {errors.onlinePlayers ? <span className="field__error">{errors.onlinePlayers}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="maxPlayers">Максимум игроков</label>
          <input
            id="maxPlayers"
            inputMode="numeric"
            value={numeric.maxPlayers}
            onChange={(event) => updateNumeric('maxPlayers', event.target.value)}
            placeholder="—"
            aria-invalid={errors.maxPlayers ? 'true' : undefined}
          />
          {errors.maxPlayers ? <span className="field__error">{errors.maxPlayers}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="storeOpen">Магазин открыт</label>
          <select
            id="storeOpen"
            value={form.storeOpen ? 'yes' : 'no'}
            onChange={(event) => update('storeOpen', event.target.value === 'yes')}
          >
            <option value="yes">Да, продажи идут</option>
            <option value="no">Нет, показывать сообщение</option>
          </select>
          <span className="field__hint">Влияет на страницу оформления заказа.</span>
        </div>

        <div className="field field--full">
          <label htmlFor="storeClosedMessage">Сообщение при закрытом магазине</label>
          <input
            id="storeClosedMessage"
            value={form.storeClosedMessage}
            onChange={(event) => update('storeClosedMessage', event.target.value)}
            aria-invalid={errors.storeClosedMessage ? 'true' : undefined}
          />
          {errors.storeClosedMessage ? (
            <span className="field__error">{errors.storeClosedMessage}</span>
          ) : null}
        </div>
      </div>

      <h2 style={{ fontSize: 20, margin: '26px 0 4px' }}>Бренд и сезон</h2>
      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="brand">Название проекта</label>
          <input
            id="brand"
            value={form.brand}
            onChange={(event) => update('brand', event.target.value)}
            aria-invalid={errors.brand ? 'true' : undefined}
          />
          {errors.brand ? <span className="field__error">{errors.brand}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="season">Сезон / баннер</label>
          <input
            id="season"
            value={form.season}
            onChange={(event) => update('season', event.target.value)}
            aria-invalid={errors.season ? 'true' : undefined}
          />
          {errors.season ? <span className="field__error">{errors.season}</span> : null}
        </div>

        <div className="field field--full">
          <label htmlFor="tagline">Слоган</label>
          <input
            id="tagline"
            value={form.tagline}
            onChange={(event) => update('tagline', event.target.value)}
            aria-invalid={errors.tagline ? 'true' : undefined}
          />
          {errors.tagline ? <span className="field__error">{errors.tagline}</span> : null}
        </div>
      </div>

      <h2 style={{ fontSize: 20, margin: '26px 0 4px' }}>Ссылки</h2>
      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="discordUrl">Discord</label>
          <input
            id="discordUrl"
            value={form.discordUrl}
            onChange={(event) => update('discordUrl', event.target.value)}
            aria-invalid={errors.discordUrl ? 'true' : undefined}
          />
          {errors.discordUrl ? <span className="field__error">{errors.discordUrl}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="telegramUrl">Telegram</label>
          <input
            id="telegramUrl"
            value={form.telegramUrl}
            onChange={(event) => update('telegramUrl', event.target.value)}
            aria-invalid={errors.telegramUrl ? 'true' : undefined}
          />
          {errors.telegramUrl ? <span className="field__error">{errors.telegramUrl}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="supportEmail">E-mail поддержки</label>
          <input
            id="supportEmail"
            value={form.supportEmail}
            onChange={(event) => update('supportEmail', event.target.value)}
            aria-invalid={errors.supportEmail ? 'true' : undefined}
          />
          {errors.supportEmail ? <span className="field__error">{errors.supportEmail}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="javaRangeHint">Подпись под версиями</label>
          <input
            id="javaRangeHint"
            value={form.javaRangeHint}
            onChange={(event) => update('javaRangeHint', event.target.value)}
            aria-invalid={errors.javaRangeHint ? 'true' : undefined}
          />
          {errors.javaRangeHint ? <span className="field__error">{errors.javaRangeHint}</span> : null}
        </div>
      </div>

      <div className="preview-panel" style={{ marginTop: 24 }}>
        <div className="address-card__label" style={{ marginBottom: 6 }}>
          <span>Адрес, который увидят игроки</span>
          <span className="badge">{dirtyFields.length ? 'черновик' : 'как на сайте'}</span>
        </div>
        <code style={{ fontSize: 18 }}>{previewAddress || '—'}</code>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {dirtyFields.length
            ? `не сохранено полей: ${dirtyFields.length} — на сайте появится после «Сохранить и опубликовать»`
            : 'совпадает с сохранённой версией'}
        </div>
      </div>

      <div className="form-footer">
        <button type="submit" className="btn btn--primary" disabled={state === 'saving'}>
          {state === 'saving' ? 'Сохраняем…' : 'Сохранить и опубликовать'}
        </button>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={resetToInitial}
          disabled={dirtyFields.length === 0 || state === 'saving'}
        >
          Отменить правки
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={refreshFromServer}
          disabled={state === 'saving'}
        >
          Обновить с сервера
        </button>

        <span
          className="save-state"
          data-tone={state === 'saved' ? 'ok' : state === 'error' ? 'error' : undefined}
        >
          {message}
        </span>
      </div>

      {toast ? (
        <div
          className="toast"
          style={
            toastTone === 'warn'
              ? { borderColor: 'rgba(251,191,36,0.5)', background: 'rgba(35,26,5,0.94)', color: '#fde68a' }
              : undefined
          }
        >
          {toast}
        </div>
      ) : null}
    </form>
  );
}
