/**
 * РИЛИКИ — пакеты и калькулятор по одной формуле.
 *
 * Исправляемый баг: подпись «₽ за 1 000» была вписана руками и не совпадала
 * с ценой пакета (11,90 при 119 ₽/10 000 — верно, но при изменении цены
 * лейбл оставался старым). Теперь цена за 1 000 всегда вычисляется.
 */

export type RelicPack = {
  amount: number;
  price: number;
  oldPrice: number;
  best?: boolean;
};

export const RELIC_PACKS: RelicPack[] = [
  { amount: 5_000, price: 69, oldPrice: 99 },
  { amount: 10_000, price: 119, oldPrice: 169 },
  { amount: 25_000, price: 249, oldPrice: 349 },
  { amount: 50_000, price: 449, oldPrice: 649 },
  { amount: 100_000, price: 799, oldPrice: 1_099, best: true },
  { amount: 250_000, price: 1_849, oldPrice: 2_499 },
  { amount: 500_000, price: 3_499, oldPrice: 4_799 },
  { amount: 750_000, price: 4_999, oldPrice: 6_899 },
  { amount: 1_000_000, price: 6_499, oldPrice: 8_999 },
];

export const MIN_RELICS = 1;
export const MAX_RELICS = 1_000_000;

/** Цена за 1 000 риликов — считается, а не пишется руками. */
export function pricePerThousand(pack: Pick<RelicPack, 'amount' | 'price'>): number {
  return (pack.price / pack.amount) * 1000;
}

export function formatPerThousand(pack: Pick<RelicPack, 'amount' | 'price'>): string {
  return `${pricePerThousand(pack).toFixed(2).replace('.', ',')} ₽ за 1 000`;
}

export function relicPackDiscount(pack: RelicPack): number {
  if (pack.oldPrice <= pack.price) return 0;
  return Math.round((1 - pack.price / pack.oldPrice) * 100);
}

/**
 * Цена произвольного количества риликов.
 * Формула: базовая ставка 0,0119 ₽ за рилик со ступенчатым понижением.
 * Считается НА СЕРВЕРЕ при оформлении — цену из браузера не принимаем.
 */
export function relicPrice(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const qty = Math.min(MAX_RELICS, Math.max(MIN_RELICS, Math.floor(amount)));
  const rate = qty >= 500_000 ? 0.0065 : qty >= 100_000 ? 0.00799 : qty >= 25_000 ? 0.00996 : 0.0119;
  return Math.max(1, Math.round(qty * rate));
}

export function isRelicAmountValid(amount: unknown): amount is number {
  return (
    typeof amount === 'number' &&
    Number.isInteger(amount) &&
    amount >= MIN_RELICS &&
    amount <= MAX_RELICS
  );
}
