import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CASES,
  RARITY_LABELS,
  dropChance,
  dropLabel,
  minKeyPrice,
  packDiscount,
  pricePerKey,
  pricePerKeyIsExact,
  topDrops,
  validateCases,
  weightSum,
} from '@/lib/cases';
import { formatRub } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Кейсы — Супер, Легендарный и Мега',
  description:
    'Состав и открытые шансы всех кейсов KingGrief. Сумма вероятностей каждого кейса — 100%.',
};

export default function CasesPage() {
  const validation = validateCases().filter((item) => item.problems.length > 0);

  return (
    <section className="block" style={{ paddingTop: 56 }}>
      <div className="container">
        <span className="eyebrow">{CASES.length} кейса · открытые шансы</span>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>Кейсы KingGrief</h1>
        <p className="muted" style={{ maxWidth: 720, marginTop: 14 }}>
          Награды и шансы берутся из одного каталога (<code>lib/cases.ts</code>), поэтому главная
          страница и эта страница всегда показывают одно и то же. Сумма шансов каждого кейса
          проверяется автоматически.
        </p>

        {validation.length > 0 ? (
          <div className="alert" style={{ marginTop: 20 }}>
            <strong>Каталог кейсов не прошёл проверку:</strong>
            <ul>
              {validation.map((item) => (
                <li key={item.slug}>
                  {item.slug}: {item.problems.join('; ')}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 20 }}>
            <span className="badge badge--green">
              <span className="dot" /> все кейсы: сумма шансов 100%
            </span>
            <span className="badge">награды не скрываются</span>
          </div>
        )}

        <div className="stack" style={{ marginTop: 34, gap: 26 }}>
          {CASES.map((item) => {
            const sum = weightSum(item);
            const top = topDrops(item, 3);

            return (
              <div key={item.slug} className="card" style={{ borderColor: `${item.accent}55` }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: 26, color: item.accent }}>{item.name}</h2>
                    <p className="muted" style={{ marginTop: 6, maxWidth: 620 }}>
                      {item.shortDescription}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="badge badge--gold">от {formatRub(minKeyPrice(item))}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {item.drops.length} позиций · {sum}%
                    </div>
                  </div>
                </div>

                <div className="row" style={{ marginTop: 16, gap: 10 }}>
                  {top.map((drop) => (
                    <span key={dropLabel(drop)} className="badge">
                      {dropLabel(drop)} · {dropChance(item, drop).toFixed(0)}%
                    </span>
                  ))}
                  <span className="muted" style={{ fontSize: 12 }}>
                    — самые редкие награды
                  </span>
                </div>

                <h3 style={{ fontSize: 16, marginTop: 22 }}>Наборы ключей</h3>
                <div className="privilege-grid" style={{ marginTop: 12 }}>
                  {item.packs.map((pack) => (
                    <div
                      key={pack.count}
                      className="privilege-card"
                      style={{ padding: 16 }}
                    >
                      <div className="privilege-card__tier">
                        {item.name} · {pack.count} × ключ
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <strong style={{ fontSize: 18 }}>{formatRub(pack.price)}</strong>
                        <span className="muted" style={{ fontSize: 13, textDecoration: 'line-through' }}>
                          {formatRub(pack.oldPrice)}
                        </span>
                        {packDiscount(pack) > 0 ? (
                          <span className="badge badge--green">−{packDiscount(pack)}%</span>
                        ) : null}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {pricePerKeyIsExact(pack) ? '' : '≈ '}
                        {pricePerKey(pack)} ₽ за ключ
                      </div>
                      <Link
                        href={`/checkout?item=${item.slug}&pack=${pack.count}`}
                        className="btn btn--primary btn--sm"
                        style={{ marginTop: 6 }}
                      >
                        В корзину
                      </Link>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 16, marginTop: 24 }}>
                  Все награды и шансы{' '}
                  <span className="muted" style={{ fontSize: 13 }}>
                    ({item.drops.length} позиций, сумма {sum}%)
                  </span>
                </h3>
                <div style={{ overflowX: 'auto', marginTop: 10 }}>
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th>Награда</th>
                        <th>Редкость</th>
                        <th>Шанс</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.drops.map((drop) => (
                        <tr key={`${drop.kind}-${dropLabel(drop)}-${drop.weight}`}>
                          <td>{dropLabel(drop)}</td>
                          <td className="muted">{RARITY_LABELS[drop.rarity]}</td>
                          <td>
                            <strong>{dropChance(item, drop).toFixed(0)}%</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
