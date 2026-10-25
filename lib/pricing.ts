/**
 * ПЕРЕСЧЁТ ЦЕНЫ НА СЕРВЕРЕ.
 *
 * Цена и название всегда берутся из каталога по идентификатору товара.
 * Значения, пришедшие из браузера (price, name, total), игнорируются —
 * иначе через devtools можно оформить D.OWNER за 1 ₽.
 */
import { BY_SLUG as PRIVILEGE_BY_SLUG } from './catalog';
import { CASE_BY_SLUG, pricePerKey } from './cases';
import { RELIC_PACKS, relicPrice } from './relics';

export type CartLine =
  | { kind: 'privilege'; slug: string; qty: number }
  | { kind: 'case'; slug: string; packCount: number; qty: number }
  | { kind: 'relics'; amount: number; qty: number };

export type PricedLine = {
  kind: CartLine['kind'];
  title: string;
  unitPrice: number;
  qty: number;
  total: number;
  meta?: string;
};

export type PricingResult =
  | { ok: true; lines: PricedLine[]; total: number }
  | { ok: false; errors: string[] };

const MAX_QTY = 20;

function normalizeQty(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(MAX_QTY, n);
}

/** Считает корзину. Любая неизвестная позиция — ошибка, а не «бесплатно». */
export function priceCart(input: CartLine[]): PricingResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, errors: ['Корзина пуста'] };
  }
  if (input.length > 20) {
    return { ok: false, errors: ['Слишком много позиций в заказе'] };
  }

  const errors: string[] = [];
  const lines: PricedLine[] = [];

  for (const line of input) {
    const qty = normalizeQty((line as { qty?: unknown }).qty);

    if (line.kind === 'privilege') {
      const privilege = PRIVILEGE_BY_SLUG.get(line.slug);
      if (!privilege) {
        errors.push(`Неизвестная привилегия: ${line.slug}`);
        continue;
      }
      lines.push({
        kind: 'privilege',
        title: `Привилегия ${privilege.name}`,
        unitPrice: privilege.price,
        qty,
        total: privilege.price * qty,
      });
      continue;
    }

    if (line.kind === 'case') {
      const item = CASE_BY_SLUG.get(line.slug);
      if (!item) {
        errors.push(`Неизвестный кейс: ${line.slug}`);
        continue;
      }
      const pack = item.packs.find((candidate) => candidate.count === Number(line.packCount));
      if (!pack) {
        errors.push(`У кейса ${item.name} нет набора на ${line.packCount} ключей`);
        continue;
      }
      lines.push({
        kind: 'case',
        title: `${item.name} ×${pack.count}`,
        unitPrice: pack.price,
        qty,
        total: pack.price * qty,
        meta: `${pricePerKey(pack)} ₽ за ключ`,
      });
      continue;
    }

    if (line.kind === 'relics') {
      const amount = Number(line.amount);
      if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
        errors.push('Количество риликов должно быть целым числом 1…1 000 000');
        continue;
      }
      // Если количество совпадает с пакетом — берём цену пакета (там скидка).
      const pack = RELIC_PACKS.find((item) => item.amount === amount);
      const unitPrice = pack ? pack.price : relicPrice(amount);
      lines.push({
        kind: 'relics',
        title: `${amount.toLocaleString('ru-RU')} риликов`,
        unitPrice,
        qty,
        total: unitPrice * qty,
        meta: pack ? 'цена пакета' : 'расчёт по формуле',
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    lines,
    total: lines.reduce((sum, line) => sum + line.total, 0),
  };
}

/** Разбор строки запроса вида ?item=king или ?item=relics:25000 */
export function parseItemParam(param: string | undefined | null): CartLine | null {
  if (!param) return null;
  const [kind, value] = param.split(':');

  if (kind === 'relics') {
    const amount = Number(value);
    return Number.isInteger(amount) && amount > 0
      ? { kind: 'relics', amount, qty: 1 }
      : null;
  }

  if (PRIVILEGE_BY_SLUG.has(param)) return { kind: 'privilege', slug: param, qty: 1 };

  if (CASE_BY_SLUG.has(param)) return { kind: 'case', slug: param, packCount: 1, qty: 1 };

  return null;
}
