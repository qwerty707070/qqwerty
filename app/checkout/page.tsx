import type { Metadata } from 'next';
import Link from 'next/link';
import { getSettings } from '@/lib/settings-store';
import { formatRub } from '@/lib/catalog';
import { type CartLine, parseItemParam, priceCart } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Оформление заказа' };

type SearchParams = {
  searchParams: { item?: string; pack?: string; qty?: string };
};

export default async function CheckoutPage({ searchParams }: SearchParams) {
  const settings = await getSettings();

  // Магазин закрыт — показываем сообщение из настроек (то самое поле из админки).
  if (!settings.storeOpen) {
    return (
      <div className="container login-wrap">
        <div className="login-card">
          <span className="badge badge--gold">
            <span className="dot" /> магазин закрыт
          </span>
          <h1 style={{ marginTop: 14 }}>Приём заказов приостановлен</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            {settings.storeClosedMessage}
          </p>
          <div className="row" style={{ marginTop: 18 }}>
            <a href={settings.discordUrl} className="btn btn--ghost btn--sm">
              Discord
            </a>
            <a href={`mailto:${settings.supportEmail}`} className="btn btn--ghost btn--sm">
              Написать на почту
            </a>
          </div>
        </div>
      </div>
    );
  }

  const parsed = parseItemParam(searchParams.item);
  const line: CartLine | null = parsed
    ? parsed.kind === 'case'
      ? { ...parsed, packCount: Number(searchParams.pack ?? 1) }
      : parsed
    : null;

  const priced = line ? priceCart([{ ...line, qty: Number(searchParams.qty ?? 1) } as CartLine]) : null;

  return (
    <section className="block" style={{ paddingTop: 56 }}>
      <div className="container">
        <span className="eyebrow">Оформление</span>
        <h1 style={{ fontSize: 'clamp(30px, 4.4vw, 44px)' }}>Проверьте заказ</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 640 }}>
          Цена и состав пересчитаны на сервере по каталогу. Сервер: <code>{settings.serverIp}</code>,
          выдача после подтверждения оплаты.
        </p>

        <div className="card" style={{ marginTop: 24 }}>
          {!priced ? (
            <>
              <p>Товар не выбран.</p>
              <div className="row" style={{ marginTop: 14 }}>
                <Link href="/privileges" className="btn btn--primary btn--sm">
                  Привилегии
                </Link>
                <Link href="/cases" className="btn btn--ghost btn--sm">
                  Кейсы
                </Link>
                <Link href="/relics" className="btn btn--ghost btn--sm">
                  Рилики
                </Link>
              </div>
            </>
          ) : !priced.ok ? (
            <div className="alert">
              <strong>Заказ не может быть оформлен:</strong>
              <ul>
                {priced.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Позиция</th>
                    <th>Цена</th>
                    <th>Кол-во</th>
                    <th>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {priced.lines.map((item) => (
                    <tr key={item.title}>
                      <td>
                        {item.title}
                        {item.meta ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {item.meta}
                          </div>
                        ) : null}
                      </td>
                      <td>{formatRub(item.unitPrice)}</td>
                      <td>{item.qty}</td>
                      <td>
                        <strong>{formatRub(item.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
                <span className="muted">Оплата: ЮKassa и Robokassa · выдача после подтверждения</span>
                <strong style={{ fontSize: 24 }}>{formatRub(priced.total)}</strong>
              </div>

              <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
                Платёжный шлюз в этой сборке не подключён: заказ создаётся только после
                подтверждения вебхука провайдера (см. раздел 6 в BUGREPORT.md).
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
