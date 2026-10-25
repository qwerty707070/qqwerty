import type { Metadata } from 'next';
import Link from 'next/link';
import { PrivilegeCard } from '@/components/PrivilegeCard';
import {
  PRIVILEGES,
  cumulativeFeatureCount,
  discountPercent,
  formatRub,
  inheritanceChain,
} from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Привилегии — 14 уровней от PEGAS до D.OWNER',
  description:
    '14 уровней привилегий KingGrief: состав, цены и скидки. Каждая привилегия наследует возможности предыдущей.',
};

export default function PrivilegesPage() {
  const cheapestFirst = [...PRIVILEGES].sort((a, b) => a.price - b.price);

  return (
    <>
      <section className="block" style={{ paddingTop: 56 }}>
        <div className="container">
          <span className="eyebrow">Королевский набор</span>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>Привилегии KingGrief</h1>
          <p className="muted" style={{ maxWidth: 700, marginTop: 14 }}>
            14 уровней — от PEGAS до D.OWNER. Каждая привилегия наследует возможности предыдущей.
            Все числа на этой странице вычисляются из единого каталога{' '}
            <code>lib/catalog.ts</code>, поэтому карточка и страница уровня всегда совпадают.
          </p>

          <div className="row" style={{ marginTop: 22 }}>
            <span className="badge badge--gold">от {formatRub(Math.min(...PRIVILEGES.map((p) => p.price)))}</span>
            <span className="badge">скидки до {Math.max(...PRIVILEGES.map((p) => discountPercent(p.price, p.oldPrice)))}%</span>
            <span className="badge">{PRIVILEGES.length} уровней</span>
            <Link href="#compare" className="btn btn--ghost btn--sm">
              Сравнить всё
            </Link>
          </div>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="privilege-grid">
            {cheapestFirst.map((privilege) => (
              <PrivilegeCard key={privilege.slug} privilege={privilege} />
            ))}
          </div>
        </div>
      </section>

      <section className="block" id="compare">
        <div className="container card">
          <div className="section-head">
            <div>
              <span className="eyebrow">Сравнение</span>
              <h2>Что даёт каждый уровень</h2>
              <p>
                «Новых» — сколько возможностей добавляет сам уровень, «всего» — накопленный состав
                с учётом наследования. Обе цифры считаются функцией, а не вбиты руками.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>Наследует</th>
                  <th>Новых</th>
                  <th>Всего по цепочке</th>
                  <th>Цена</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {PRIVILEGES.map((privilege) => {
                  const chain = inheritanceChain(privilege.slug);
                  return (
                    <tr key={privilege.slug}>
                      <td>
                        <strong style={{ color: privilege.accent }}>{privilege.name}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          tier {String(privilege.tier).padStart(2, '0')}
                        </div>
                      </td>
                      <td className="muted">{privilege.inherits ? privilege.inherits.toUpperCase() : '—'}</td>
                      <td>+{privilege.own.length}</td>
                      <td>
                        {cumulativeFeatureCount(privilege.slug)}
                        <span className="muted" style={{ fontSize: 12 }}>
                          {' '}
                          ({chain.length} ур.)
                        </span>
                      </td>
                      <td>
                        <strong>{formatRub(privilege.price)}</strong>
                        <span className="old muted" style={{ marginLeft: 6, fontSize: 12 }}>
                          {formatRub(privilege.oldPrice)}
                        </span>
                      </td>
                      <td>
                        <Link href={`/privileges/${privilege.slug}`} className="btn btn--ghost btn--sm">
                          открыть
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
