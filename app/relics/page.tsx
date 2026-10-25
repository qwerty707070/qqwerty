import type { Metadata } from 'next';
import Link from 'next/link';
import {
  RELIC_PACKS,
  formatPerThousand,
  pricePerThousand,
  relicPackDiscount,
  relicPrice,
} from '@/lib/relics';
import { formatRub } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Рилики — пакеты и калькулятор',
  description: 'Пакеты риликов KingGrief с прозрачной ценой за 1 000 и калькулятор любого количества.',
};

export default function RelicsPage() {
  const cheapestRate = Math.min(...RELIC_PACKS.map(pricePerThousand));
  const samples = [5_000, 12_500, 40_000, 75_000];

  return (
    <>
      <section className="block" style={{ paddingTop: 56 }}>
        <div className="container">
          <span className="eyebrow">{RELIC_PACKS.length} пакетов</span>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>Рилики</h1>
          <p className="muted" style={{ maxWidth: 720, marginTop: 14 }}>
            Цена за 1 000 риликов вычисляется из цены пакета — подпись не может разойтись с реальной
            ценой. Самая низкая ставка: {cheapestRate.toFixed(2).replace('.', ',')} ₽ за 1 000.
          </p>

          <div className="privilege-grid" style={{ marginTop: 30 }}>
            {RELIC_PACKS.map((pack) => (
              <article key={pack.amount} className="privilege-card">
                <div className="privilege-card__tier">
                  {pack.amount.toLocaleString('ru-RU')} риликов
                  {pack.best ? ' · макс. выгода' : ''}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {formatPerThousand(pack)}
                </div>
                <div className="price-row">
                  <span className="price">{formatRub(pack.price)}</span>
                  <span className="old">{formatRub(pack.oldPrice)}</span>
                  {relicPackDiscount(pack) > 0 ? (
                    <span className="discount">−{relicPackDiscount(pack)}%</span>
                  ) : null}
                </div>
                <Link
                  href={`/checkout?item=relics:${pack.amount}`}
                  className="btn btn--primary btn--sm"
                  style={{ marginTop: 6 }}
                >
                  В корзину
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="block" id="calculator">
        <div className="container card">
          <h2 style={{ fontSize: 24 }}>Калькулятор</h2>
          <p className="muted" style={{ marginTop: 8, maxWidth: 620 }}>
            Итоговая цена всё равно пересчитывается на сервере при оформлении: значение из браузера
            не принимается.
          </p>

          <div style={{ overflowX: 'auto', marginTop: 18 }}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Количество</th>
                  <th>Цена</th>
                  <th>За 1 000</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {samples.map((amount) => {
                  const price = relicPrice(amount);
                  return (
                    <tr key={amount}>
                      <td>{amount.toLocaleString('ru-RU')} риликов</td>
                      <td>
                        <strong>{formatRub(price)}</strong>
                      </td>
                      <td className="muted">{formatPerThousand({ amount, price })}</td>
                      <td>
                        <Link
                          href={`/checkout?item=relics:${amount}`}
                          className="btn btn--ghost btn--sm"
                        >
                          оформить
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
