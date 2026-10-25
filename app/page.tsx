import Link from 'next/link';
import { ServerAddressCard } from '@/components/ServerAddressCard';
import { PrivilegeCard } from '@/components/PrivilegeCard';
import { getSettings } from '@/lib/settings-store';
import { connectAddress } from '@/lib/settings';
import { PRIVILEGES, formatRub, topPrivileges } from '@/lib/catalog';

// Настройки читаются на КАЖДЫЙ запрос: страница не должна «запекаться»
// со старым IP на этапе сборки.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const settings = await getSettings();
  const top = topPrivileges();
  const minPrice = Math.min(...PRIVILEGES.map((item) => item.price));

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <span className="hero__eyebrow badge badge--gold">
              <span className="dot" />
              {settings.season} · открыт
            </span>

            <h1>
              {settings.brand}
              <span>/S1</span>
            </h1>
            <p className="lead">
              {settings.tagline}. Привилегии, кейсы и рилики — всё, чтобы начать доминировать с
              первого дня. IP ниже обновляется сразу после правки в админке.
            </p>

            <div className="hero__actions">
              <Link href="/privileges" className="btn btn--primary">
                Перейти в магазин
              </Link>
              <Link href="#connect" className="btn btn--ghost">
                Начать играть
              </Link>
            </div>

            <div className="stats">
              <div>
                <div className="stat__value">{PRIVILEGES.length}</div>
                <div className="stat__label">привилегий</div>
              </div>
              <div>
                <div className="stat__value">{formatRub(minPrice)}</div>
                <div className="stat__label">стартовая цена</div>
              </div>
              <div>
                <div className="stat__value">
                  {settings.onlinePlayers === null ? '—' : settings.onlinePlayers}
                </div>
                <div className="stat__label">онлайн</div>
              </div>
            </div>
          </div>

          <ServerAddressCard initial={settings} />
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">01 / привилегии</span>
              <h2>Выбор игроков</h2>
              <p>
                Четыре уровня, которые берут чаще всего. Состав и количество возможностей считаются
                из одного каталога — расхождений между страницами больше нет.
              </p>
            </div>
            <Link href="/privileges" className="btn btn--ghost btn--sm">
              Все привилегии →
            </Link>
          </div>

          <div className="privilege-grid">
            {top.map((privilege) => (
              <PrivilegeCard key={privilege.slug} privilege={privilege} variant="compact" />
            ))}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container card">
          <div className="section-head" style={{ marginBottom: 12 }}>
            <div>
              <span className="eyebrow">02 / подключение</span>
              <h2>Заходи в империю</h2>
              <p>
                {settings.javaRangeHint}. IP можно скопировать одним нажатием — он приходит из
                настроек, а не из кода страницы.
              </p>
            </div>
            <div className="row">
              <a href={settings.discordUrl} className="btn btn--ghost btn--sm">
                Discord
              </a>
              <a href={settings.telegramUrl} className="btn btn--ghost btn--sm">
                Telegram
              </a>
            </div>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <span className="badge">IP сервера</span>
            {/* адрес собран одной строкой — так его видно и копируется целиком */}
            <code style={{ fontSize: 16 }}>{connectAddress(settings)}</code>
            <span className="badge">версии {settings.versions}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              последнее изменение настроек:{' '}
              {new Date(settings.updatedAt).toLocaleString('ru-RU')} ({settings.updatedBy})
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
