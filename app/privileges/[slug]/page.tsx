import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrivilegeCard } from '@/components/PrivilegeCard';
import {
  PRIVILEGES,
  capabilityCount,
  cumulativeFeatureCount,
  discountPercent,
  formatRub,
  fullCapabilities,
  getPrivilege,
  inheritanceChain,
} from '@/lib/catalog';

export const dynamic = 'force-dynamic';

type Params = { params: { slug: string } };

export function generateMetadata({ params }: Params): Metadata {
  const privilege = getPrivilege(params.slug);
  if (!privilege) return { title: 'Привилегия не найдена' };
  return {
    title: `${privilege.name} — ${privilege.tagline}`,
    description: privilege.description,
  };
}

export default function PrivilegePage({ params }: Params) {
  const privilege = getPrivilege(params.slug);
  if (!privilege) notFound();

  const capabilities = fullCapabilities(privilege.slug);
  const total = capabilityCount(privilege.slug);
  const cumulative = cumulativeFeatureCount(privilege.slug);
  const discount = discountPercent(privilege.price, privilege.oldPrice);
  const chain = inheritanceChain(privilege.slug).slice(0, -1);

  const neighbours = PRIVILEGES.filter(
    (item) => item.tier === privilege.tier - 1 || item.tier === privilege.tier + 1,
  );

  return (
    <>
      <section className="block" style={{ paddingTop: 52 }}>
        <div className="container">
          <div className="row" style={{ marginBottom: 16 }}>
            <Link href="/privileges" className="muted" style={{ fontSize: 13 }}>
              ← Все привилегии
            </Link>
            <span className="badge" style={{ color: privilege.accent, borderColor: privilege.accent }}>
              tier {String(privilege.tier).padStart(2, '0')}
            </span>
            <span className="badge badge--green">
              <span className="dot" /> в наличии
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.7fr)',
              gap: 28,
              alignItems: 'start',
            }}
          >
            <div>
              <h1 style={{ fontSize: 'clamp(34px, 5vw, 56px)', color: privilege.accent }}>
                {privilege.name}
              </h1>
              <p className="muted" style={{ fontSize: 18, marginTop: 6 }}>
                {privilege.tagline}
              </p>
              <p style={{ marginTop: 18, maxWidth: 640 }}>{privilege.description}</p>

              <div className="card" style={{ marginTop: 26 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 22 }}>Что входит</h2>
                  <span className="badge badge--gold">{total} возможностей</span>
                </div>

                <ul className="feature-list" style={{ marginTop: 16, gap: 10 }}>
                  {capabilities.map((feature, index) => (
                    <li
                      key={feature}
                      className={index === 0 && privilege.inherits ? 'muted' : undefined}
                    >
                      {feature}
                    </li>
                  ))}
                </ul>

                <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
                  «{total} возможностей» — это пункт «Всё из{' '}
                  {privilege.inherits ? privilege.inherits.toUpperCase() : '—'}» плюс собственные
                  возможности уровня. С учётом всей цепочки наследования уровень даёт{' '}
                  <strong>{cumulative}</strong> возможностей
                  {chain.length ? ` (${chain.length} предыдущих уровней)` : ''}.
                </p>

                <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                  Точный состав прав устанавливает администрация сервера и может менять его.
                  Актуальный список — на этой странице.
                </p>
              </div>
            </div>

            <aside className="address-card">
              <div className="address-card__label">
                <span>Стоимость</span>
                {discount > 0 ? <span className="badge badge--green">−{discount}%</span> : null}
              </div>
              <div className="price-row" style={{ paddingTop: 0 }}>
                <span className="price" style={{ fontSize: 34 }}>
                  {formatRub(privilege.price)}
                </span>
                <span className="old" style={{ fontSize: 15 }}>
                  {formatRub(privilege.oldPrice)}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                выгода {formatRub(privilege.oldPrice - privilege.price)} · {discount}%
              </p>

              <div className="address-card__actions">
                <Link href={`/checkout?item=${privilege.slug}`} className="btn btn--primary">
                  Добавить в корзину
                </Link>
              </div>

              <ul className="feature-list feature-list--muted" style={{ marginTop: 18, fontSize: 13 }}>
                <li>Выдача после подтверждения оплаты</li>
                <li>Никнейм получателя указывается при оформлении</li>
                <li>Поддержка в Discord 24/7</li>
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-head">
            <h2>Соседние уровни</h2>
          </div>
          <div className="privilege-grid">
            {neighbours.map((item) => (
              <PrivilegeCard key={item.slug} privilege={item} variant="compact" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
