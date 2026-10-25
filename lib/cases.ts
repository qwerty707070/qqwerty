/**
 * КАТАЛОГ КЕЙСОВ — единственный источник данных о наградах и шансах.
 *
 * Исправляемые баги:
 *  1. на главной и на /cases были РАЗНЫЕ топ-награды и разные привилегии
 *     (главная обещала KING/D.OWNER, страница кейсов показывала RABBIT/VAMPIRE);
 *  2. «9 позиций · 100%», а видимые шансы давали 88% — часть наград не выводилась;
 *  3. цена за ключ в наборе считалась округлением вверх (139 ₽ / 2 = «70 ₽»,
 *     хотя реально 69,5 ₽).
 *
 * Теперь все числа вычисляются, а полнота и сумма шансов проверяются
 * функцией validateCases() — её вызывает и тест, и страница.
 */

export type DropRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type Drop =
  | { kind: 'relics'; amount: number; weight: number; rarity: DropRarity }
  | { kind: 'privilege'; slug: string; weight: number; rarity: DropRarity }
  | { kind: 'key'; caseSlug: string; count: number; weight: number; rarity: DropRarity };

export type KeyPack = { count: number; price: number; oldPrice: number };

export type CaseItem = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  accent: string;
  packs: KeyPack[];
  drops: Drop[];
};

export const RARITY_LABELS: Record<DropRarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

export const CASES: CaseItem[] = [
  {
    slug: 'super',
    name: 'Супер кейс',
    shortDescription:
      'Фиолетовый сундук с магическими частицами. Базовые награды, ресурсы и шанс на среднюю привилегию.',
    description:
      'Стартовый кейс: рилики на прокачку и небольшая, но реальная вероятность получить привилегию KING.',
    accent: '#a855f7',
    packs: [
      { count: 1, price: 29, oldPrice: 39 },
      { count: 5, price: 119, oldPrice: 145 },
      { count: 10, price: 199, oldPrice: 290 },
    ],
    drops: [
      { kind: 'relics', amount: 100, weight: 30, rarity: 'common' },
      { kind: 'relics', amount: 250, weight: 22, rarity: 'common' },
      { kind: 'relics', amount: 500, weight: 16, rarity: 'uncommon' },
      { kind: 'relics', amount: 1000, weight: 12, rarity: 'rare' },
      { kind: 'key', caseSlug: 'legendary', count: 1, weight: 8, rarity: 'rare' },
      { kind: 'privilege', slug: 'cobra', weight: 5, rarity: 'epic' },
      { kind: 'relics', amount: 2500, weight: 3, rarity: 'epic' },
      { kind: 'privilege', slug: 'king', weight: 3, rarity: 'legendary' },
      { kind: 'relics', amount: 5000, weight: 1, rarity: 'legendary' },
    ],
  },
  {
    slug: 'legendary',
    name: 'Легендарный кейс',
    shortDescription:
      'Золотой сундук с огненными искрами. Повышенный шанс на привилегии GOD и D.MODER и крупные пачки риликов.',
    description:
      'Кейс среднего уровня: ощутимо больше риликов и шанс выйти сразу на административный уровень.',
    accent: '#fbbf24',
    packs: [
      { count: 1, price: 49, oldPrice: 69 },
      { count: 2, price: 89, oldPrice: 98 },
      { count: 3, price: 129, oldPrice: 147 },
    ],
    drops: [
      { kind: 'relics', amount: 500, weight: 30, rarity: 'common' },
      { kind: 'relics', amount: 1000, weight: 22, rarity: 'uncommon' },
      { kind: 'relics', amount: 2500, weight: 16, rarity: 'rare' },
      { kind: 'privilege', slug: 'rabbit', weight: 12, rarity: 'epic' },
      { kind: 'relics', amount: 5000, weight: 8, rarity: 'epic' },
      { kind: 'relics', amount: 7500, weight: 7, rarity: 'rare' },
      { kind: 'privilege', slug: 'god', weight: 3, rarity: 'legendary' },
      { kind: 'privilege', slug: 'dmoder', weight: 2, rarity: 'legendary' },
    ],
  },
  {
    slug: 'mega',
    name: 'Мега кейс',
    shortDescription:
      'Красно-чёрный сундук с электрическими разрядами. Здесь лежат OPKA, D.ADMIN и 50 000 риликов.',
    description:
      'Максимальный кейс: самые крупные пачки риликов и шанс на топовые привилегии, включая D.OWNER.',
    accent: '#ef4444',
    packs: [
      { count: 1, price: 79, oldPrice: 99 },
      { count: 2, price: 139, oldPrice: 158 },
      { count: 3, price: 199, oldPrice: 237 },
    ],
    drops: [
      { kind: 'relics', amount: 1000, weight: 28, rarity: 'common' },
      { kind: 'relics', amount: 2500, weight: 22, rarity: 'uncommon' },
      { kind: 'relics', amount: 5000, weight: 16, rarity: 'rare' },
      { kind: 'privilege', slug: 'vampire', weight: 12, rarity: 'epic' },
      { kind: 'relics', amount: 10000, weight: 8, rarity: 'epic' },
      { kind: 'relics', amount: 15000, weight: 6, rarity: 'rare' },
      { kind: 'privilege', slug: 'dadmin', weight: 4, rarity: 'legendary' },
      { kind: 'privilege', slug: 'opka', weight: 3, rarity: 'legendary' },
      { kind: 'privilege', slug: 'downer', weight: 1, rarity: 'legendary' },
    ],
  },
];

export const CASE_BY_SLUG = new Map(CASES.map((item) => [item.slug, item]));

export function getCase(slug: string): CaseItem | undefined {
  return CASE_BY_SLUG.get(slug);
}

/* ------------------------------ вычисления ----------------------------- */

/** Сумма шансов кейса. Должна быть ровно 100. */
export function weightSum(item: CaseItem): number {
  return item.drops.reduce((sum, drop) => sum + drop.weight, 0);
}

export function dropChance(item: CaseItem, drop: Drop): number {
  const total = weightSum(item);
  return total === 0 ? 0 : (drop.weight / total) * 100;
}

export function dropLabel(drop: Drop): string {
  if (drop.kind === 'relics') {
    return `${drop.amount.toLocaleString('ru-RU')} риликов`;
  }
  if (drop.kind === 'privilege') {
    return `Привилегия ${drop.slug.toUpperCase()}`;
  }
  const target = CASE_BY_SLUG.get(drop.caseSlug);
  return `${target?.name ?? 'Кейс'} ×${drop.count}`;
}

/**
 * Цена за ключ в наборе. Округление ВНИЗ: писать «70 ₽» при 139/2 = 69,5 —
 * значит завышать цену в подписи.
 */
export function pricePerKey(pack: KeyPack): number {
  return Math.floor(pack.price / pack.count);
}

/** Есть ли остаток от деления — для подписи «≈». */
export function pricePerKeyIsExact(pack: KeyPack): boolean {
  return pack.price % pack.count === 0;
}

export function packDiscount(pack: KeyPack): number {
  if (pack.oldPrice <= pack.price) return 0;
  return Math.round((1 - pack.price / pack.oldPrice) * 100);
}

/** Минимальная цена ключа (для «от N ₽»). */
export function minKeyPrice(item: CaseItem): number {
  return Math.min(...item.packs.map((pack) => pack.price));
}

/** «Топ награды» — детерминированная выборка: редкие и дорогие вперёд. */
export function topDrops(item: CaseItem, limit = 3): Drop[] {
  const order: DropRarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
  return [...item.drops]
    .sort((a, b) => {
      const byRarity = order.indexOf(a.rarity) - order.indexOf(b.rarity);
      if (byRarity !== 0) return byRarity;
      return b.weight - a.weight;
    })
    .slice(0, limit);
}

/* ------------------------------- проверка ------------------------------ */

export type CaseValidation = { slug: string; problems: string[] };

/**
 * Проверка целостности каталога. Вызывается из теста и из страницы кейсов,
 * чтобы «88% из 100%» не могло снова попасть в продакшен.
 */
export function validateCases(cases: CaseItem[] = CASES): CaseValidation[] {
  return cases.map((item) => {
    const problems: string[] = [];
    const sum = weightSum(item);
    if (sum !== 100) problems.push(`сумма шансов ${sum}%, должно быть 100%`);
    if (item.drops.length === 0) problems.push('нет наград');
    if (item.drops.some((drop) => drop.weight <= 0)) problems.push('есть награда с нулевым шансом');
    if (item.packs.length === 0) problems.push('нет наборов ключей');
    for (const pack of item.packs) {
      if (pack.price <= 0) problems.push(`набор ${pack.count}× с нулевой ценой`);
      if (pack.oldPrice < pack.price) problems.push(`набор ${pack.count}×: старая цена ниже новой`);
    }
    for (const drop of item.drops) {
      if (drop.kind === 'key' && !CASE_BY_SLUG.has(drop.caseSlug)) {
        problems.push(`ссылка на несуществующий кейс ${drop.caseSlug}`);
      }
    }
    return { slug: item.slug, problems };
  });
}

export function casesAreValid(cases: CaseItem[] = CASES): boolean {
  return validateCases(cases).every((item) => item.problems.length === 0);
}
