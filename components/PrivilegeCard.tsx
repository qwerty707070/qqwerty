import Link from 'next/link';
import {
  type Privilege,
  capabilityCount,
  discountPercent,
  formatRub,
  newCapabilityCount,
} from '@/lib/catalog';

type Props = {
  privilege: Privilege;
  /** compact — карточка на главной, full — полный список. */
  variant?: 'compact' | 'full';
  showCompare?: boolean;
};

export function PrivilegeCard({ privilege, variant = 'full', showCompare = true }: Props) {
  const discount = discountPercent(privilege.price, privilege.oldPrice);
  const extra = newCapabilityCount(privilege.slug);
  const total = capabilityCount(privilege.slug);

  // Все цифры вычисляются из одного источника: показать «+3» там,
  // где в подробностях 6 пунктов, теперь невозможно.
  const visibleOwn = variant === 'compact' ? privilege.own.slice(0, 2) : privilege.own.slice(0, 3);
  const hidden = extra - visibleOwn.length;

  return (
    <article
      className="privilege-card"
      style={
        {
          '--accent': privilege.accent,
          '--accent-soft': privilege.accentSoft,
        } as React.CSSProperties
      }
    >
      <div className="privilege-card__tier">
        tier {String(privilege.tier).padStart(2, '0')}
        {privilege.tier === 14 ? ' · MAX' : ''}
      </div>

      <h3 className="privilege-card__name">{privilege.name}</h3>
      <p className="privilege-card__tagline">{privilege.tagline}</p>

      <ul className="feature-list">
        {privilege.inherits ? <li>Всё из {privilege.inherits.toUpperCase()}</li> : null}
        {visibleOwn.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
        {hidden > 0 ? (
          <li className="muted" style={{ color: 'var(--muted)' }}>
            +{hidden} возможностей
          </li>
        ) : null}
      </ul>

      <div className="price-row">
        <span className="price">{formatRub(privilege.price)}</span>
        <span className="old">{formatRub(privilege.oldPrice)}</span>
        {discount > 0 ? <span className="discount">−{discount}%</span> : null}
      </div>

      <div className="card-actions">
        <Link href={`/privileges/${privilege.slug}`} className="btn btn--primary btn--sm">
          Подробнее
        </Link>
        {showCompare ? (
          <Link href="/privileges#compare" className="btn btn--ghost btn--sm">
            сравнить
          </Link>
        ) : null}
      </div>

      <span className="sr-only">{`Всего возможностей уровня: ${total}`}</span>
    </article>
  );
}
