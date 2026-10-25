'use client';

/**
 * Форма настроек админки.
 *
 * Ключевые отличия от «сломанной» версии:
 *  - состояние формы живёт только здесь; после успешного PUT оно
 *    перезаписывается ОТВЕТОМ сервера (а не локальным предположением),
 *    поэтому в форме всегда то, что реально лежит в хранилище;
 *  - router.refresh() перерисовывает публичные страницы;
 *  - BroadcastChannel('kg-settings') мгновенно обновляет открытые вкладки;
 *  - ошибки валидации приходят с сервера и подсвечивают конкретные поля.
 */
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { STATUS_LABELS, connectAddress, type ServerStatus, type Settings } from '@/lib/settings';

type Props = { initial: Settings };

const STATUS_OPTIONS: ServerStatus[] = ['online', 'offline', 'maintenance', 'soon'];

export function SettingsForm({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Settings>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const address = useMemo(() => {
    const port = Number(form.serverPort);
    if (!port || port === 25565) return form.serverIp;
    return `${form.serverIp}:${port}`;
  }, [form.serverIp, form.serverPort]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
    setState('idle');
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('saving');
    setMessage('');
    setErrors({});

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          serverPort: form.serverPort === null ? null : Number(form.serverPort),
          onlinePlayers:
            form.onlinePlayers === null || String(form.onlinePlayers) === ''
              ? null
              : Number(form.onlinePlayers),
          maxPlayers:
            form.maxPlayers === null || String(form.maxPlayers) === ''
              ? null
              : Number(form.maxPlayers),
        }),
      });

      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        settings?: Settings;
        errors?: Record<string, string>;
        error?: string;
        changed?: string[];
      };

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
          setState('error');
          setMessage('Проверьте подсвеченные поля');
        } else {
          setState('error');
          setMessage(data.error ?? 'Не удалось сохранить');
        }
        return;
      }

      if (data.settings) setForm(data.settings);
      setState('saved');
      setMessage(
        data.changed && data.changed.length
          ? `Сохранено: ${data.changed.join(', ')}`
          : 'Изменений нет — значения совпадают',
      );
      setToast('Настройки сохранены — публичные страницы обновлены');

      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel('kg-settings').postMessage({ type: 'settings-updated' });
      }
      router.refresh();
      window.setTimeout(() => setToast(null), 3200);
    } catch {
      setState('error');
      setMessage('Сеть недоступна — изменения не сохранены');
    }
  };

  const field = (key: keyof Settings) => ({
    'aria-invalid': errors[key as string] ? ('true' as const) : undefined,
    value: form[key] === null || form[key] === undefined ? '' : String(form[key]),
  });

  return (
    <form className="card" onSubmit={save} noValidate>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Подключение к серверу</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
        Это поле раньше не доезжало до сайта: публичные страницы рендерились из бандла. Теперь
        значение читается из хранилища на каждый запрос.
      </p>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="serverIp">IP / домен сервера</label>
          <input
            id="serverIp"
            {...field('serverIp')}
            onChange={(event) => update('serverIp', event.target.value)}
            placeholder="play.example.net"
            autoComplete="off"
          />
          {errors.serverIp ? <span className="field__error">{errors.serverIp}</span> : null}
          <span className="field__hint">Домен или IPv4. Пробелы и протокол не допускаются.</span>
        </div>

        <div className="field">
          <label htmlFor="serverPort">Порт</label>
          <input
            id="serverPort"
            inputMode="numeric"
            {...field('serverPort')}
            onChange={(event) =>
              update('serverPort', event.target.value === '' ? null : (Number(event.target.value) as never))
            }
            placeholder="25565"
          />
          {errors.serverPort ? <span className="field__error">{errors.serverPort}</span> : null}
          <span className="field__hint">Пусто или 25565 — порт на сайте не печатается.</span>
        </div>

        <div className="field">
          <label htmlFor="serverName">Название сервера</label>
          <input
            id="serverName"
            {...field('serverName')}
            onChange={(event) => update('serverName', event.target.value)}
          />
          {errors.serverName ? <span className="field__error">{errors.serverName}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="versions">Поддерживаемые версии</label>
          <input
            id="versions"
            {...field('versions')}
            onChange={(event) => update('versions', event.target.value)}
            placeholder="1.16.5 — 1.21.4"
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
            {STATUS_OPTIONS.map((status) => (
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
            {...field('onlinePlayers')}
            onChange={(event) =>
              update(
                'onlinePlayers',
                event.target.value === '' ? null : (Number(event.target.value) as never),
              )
            }
            placeholder="—"
          />
          {errors.onlinePlayers ? (
            <span className="field__error">{errors.onlinePlayers}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="maxPlayers">Максимум игроков</label>
          <input
            id="maxPlayers"
            inputMode="numeric"
            {...field('maxPlayers')}
            onChange={(event) =>
              update('maxPlayers', event.target.value === '' ? null : (Number(event.target.value) as never))
            }
            placeholder="—"
          />
          {errors.maxPlayers ? <span className="field__error">{errors.maxPlayers}</span> : null}
        </div>
      </div>

      <h2 style={{ fontSize: 20, margin: '26px 0 4px' }}>Бренд и сезон</h2>
      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="brand">Название проекта</label>
          <input
            id="brand"
            {...field('brand')}
            onChange={(event) => update('brand', event.target.value)}
          />
          {errors.brand ? <span className="field__error">{errors.brand}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="season">Сезон / баннер</label>
          <input
            id="season"
            {...field('season')}
            onChange={(event) => update('season', event.target.value)}
          />
          {errors.season ? <span className="field__error">{errors.season}</span> : null}
        </div>

        <div className="field field--full">
          <label htmlFor="tagline">Слоган</label>
          <input
            id="tagline"
            {...field('tagline')}
            onChange={(event) => update('tagline', event.target.value)}
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
            {...field('discordUrl')}
            onChange={(event) => update('discordUrl', event.target.value)}
          />
          {errors.discordUrl ? <span className="field__error">{errors.discordUrl}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="telegramUrl">Telegram</label>
          <input
            id="telegramUrl"
            {...field('telegramUrl')}
            onChange={(event) => update('telegramUrl', event.target.value)}
          />
          {errors.telegramUrl ? <span className="field__error">{errors.telegramUrl}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="supportEmail">E-mail поддержки</label>
          <input
            id="supportEmail"
            {...field('supportEmail')}
            onChange={(event) => update('supportEmail', event.target.value)}
          />
          {errors.supportEmail ? <span className="field__error">{errors.supportEmail}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="javaRangeHint">Подпись под версиями</label>
          <input
            id="javaRangeHint"
            {...field('javaRangeHint')}
            onChange={(event) => update('javaRangeHint', event.target.value)}
          />
          {errors.javaRangeHint ? <span className="field__error">{errors.javaRangeHint}</span> : null}
        </div>
      </div>

      <div className="preview-panel" style={{ marginTop: 24 }}>
        <div className="address-card__label" style={{ marginBottom: 6 }}>
          <span>Предпросмотр адреса</span>
        </div>
        <code style={{ fontSize: 18 }}>{connectAddress({ ...form, serverIp: form.serverIp })}</code>
        <span className="muted" style={{ fontSize: 12, marginLeft: 10 }}>
          {connectAddress({ ...form }) === address ? '' : ''}
          изменения появятся на сайте после сохранения
        </span>
      </div>

      <div className="form-footer">
        <button type="submit" className="btn btn--primary" disabled={state === 'saving'}>
          {state === 'saving' ? 'Сохраняем…' : 'Сохранить и опубликовать'}
        </button>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setForm(initial);
            setErrors({});
            setState('idle');
            setMessage('');
          }}
        >
          Отменить правки
        </button>

        <span className="save-state" data-tone={state === 'saved' ? 'ok' : state === 'error' ? 'error' : undefined}>
          {message}
        </span>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </form>
  );
}
