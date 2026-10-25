/**
 * Каталог привилегий — единственный источник данных о них.
 *
 * Раньше (баг с рассинхроном) на главной, в списке и на странице уровня
 * лежали ТРИ разных копии одних и тех же привилегий, поэтому «+3 возможностей»
 * на главной превращалось в «+2» в списке, а в подробностях уровень KING имел
 * 6 пунктов против 7 в карточке. Теперь цифры ВЫЧИСЛЯЮТСЯ из одного массива,
 * и разойтись физически не могут.
 */

export type Privilege = {
  slug: string;
  tier: number;
  name: string;
  tagline: string;
  description: string;
  /** Родительский уровень, чьи возможности наследуются. null — базовый. */
  inherits: string | null;
  /** ТОЛЬКО собственные новые возможности (без «Всё из …»). */
  own: string[];
  price: number;
  oldPrice: number;
  accent: string;
  accentSoft: string;
};

export const PRIVILEGES: Privilege[] = [
  {
    slug: 'pegas',
    tier: 1,
    name: 'PEGAS',
    tagline: 'Первый шаг к трону',
    description:
      'Стартовый уровень для тех, кто только заходит в империю. Даёт базовый комфорт: точки возврата, набор ресурсов и заметный ник в списке игроков.',
    inherits: null,
    own: [
      'Префикс PEGAS в чате',
      'Стартовый набор ресурсов при входе',
      '2 точки /sethome',
      'Цветной ник в списке игроков',
    ],
    price: 19,
    oldPrice: 39,
    accent: '#8b8fa3',
    accentSoft: 'rgba(139,143,163,0.14)',
  },
  {
    slug: 'cobra',
    tier: 2,
    name: 'COBRA',
    tagline: 'Тихий укус',
    description:
      'Первый шаг в персонализацию: больше точек дома и доступ к /hat, чтобы быстро менять образ прямо в бою.',
    inherits: 'pegas',
    own: ['Префикс COBRA в чате', '4 точки /sethome', 'Доступ к /hat'],
    price: 39,
    oldPrice: 59,
    accent: '#4ade80',
    accentSoft: 'rgba(74,222,128,0.14)',
  },
  {
    slug: 'bunny',
    tier: 3,
    name: 'BUNNY',
    tagline: 'Прыжок выше',
    description:
      'Подвижность и косметика: частицы при движении подчёркивают каждый прыжок и делают вас заметным в хабе.',
    inherits: 'cobra',
    own: ['Префикс BUNNY в чате', '6 точек /sethome', 'Косметические частицы при движении'],
    price: 59,
    oldPrice: 89,
    accent: '#f9a8d4',
    accentSoft: 'rgba(249,168,212,0.14)',
  },
  {
    slug: 'rabbit',
    tier: 4,
    name: 'RABBIT',
    tagline: 'Скорость как стиль',
    description:
      'Ускорение в хабе и восемь точек возврата — быстрее добираетесь до аукциона, склада и арены.',
    inherits: 'bunny',
    own: ['Префикс RABBIT в чате', '8 точек /sethome', 'Ускорение в хабе'],
    price: 89,
    oldPrice: 129,
    accent: '#60a5fa',
    accentSoft: 'rgba(96,165,250,0.14)',
  },
  {
    slug: 'vampire',
    tier: 5,
    name: 'VAMPIRE',
    tagline: 'Кровь и власть',
    description:
      'Первый «взрослый» уровень: кровавый след выдаёт вас в бою, а десять точек дома закрывают всю карту.',
    inherits: 'rabbit',
    own: ['Префикс VAMPIRE в чате', '10 точек /sethome', 'Кровавые частицы и след'],
    price: 99,
    oldPrice: 159,
    accent: '#f87171',
    accentSoft: 'rgba(248,113,113,0.14)',
  },
  {
    slug: 'god',
    tier: 6,
    name: 'GOD',
    tagline: 'Сила на твоей стороне',
    description:
      'Золотой префикс и ежедневный бонус к риликам: уровень окупается за счёт экономики, а не только косметики.',
    inherits: 'vampire',
    own: ['Золотой префикс GOD', '12 точек /sethome', 'Ежедневный бонус к риликам'],
    price: 149,
    oldPrice: 229,
    accent: '#fbbf24',
    accentSoft: 'rgba(251,191,36,0.16)',
  },
  {
    slug: 'king',
    tier: 7,
    name: 'KING',
    tagline: 'Корона примеряет тебя',
    description:
      'Флагманская привилегия для игроков без персонала. Королевская косметика, расширенные лимиты и приоритет во всём.',
    inherits: 'god',
    own: [
      'Фиолетовый префикс KING',
      '14 точек /sethome',
      'Собственный титул в чате',
      'Королевский след и частицы',
      'Доступ к /workbench и /enderchest',
    ],
    price: 199,
    oldPrice: 299,
    accent: '#a855f7',
    accentSoft: 'rgba(168,85,247,0.16)',
  },
  {
    slug: 'dmoder',
    tier: 8,
    name: 'D.MODER',
    tagline: 'Порядок начинается с тебя',
    description:
      'Первый уровень персонала: чат команды и базовые команды модерации строго по регламенту сервера.',
    inherits: 'king',
    own: ['Префикс D.MODER', 'Доступ к чату персонала', 'Базовые команды модерации по регламенту'],
    price: 249,
    oldPrice: 399,
    accent: '#38bdf8',
    accentSoft: 'rgba(56,189,248,0.14)',
  },
  {
    slug: 'dstmoder',
    tier: 9,
    name: 'D.ST.MODER',
    tagline: 'Старший над порядком',
    description:
      'Старший модератор: расширенные команды и доступ к очереди жалоб — вы видите нарушения раньше остальных.',
    inherits: 'dmoder',
    own: ['Префикс D.ST.MODER', 'Расширенные команды модерации', 'Доступ к очереди жалоб'],
    price: 349,
    oldPrice: 499,
    accent: '#22d3ee',
    accentSoft: 'rgba(34,211,238,0.14)',
  },
  {
    slug: 'dglmoder',
    tier: 10,
    name: 'D.GLMODER',
    tagline: 'Глобальный порядок',
    description:
      'Наблюдение во всех мирах и право выдавать базовые наказания: глобальный модератор контролирует всю империю.',
    inherits: 'dstmoder',
    own: [
      'Префикс D.GLMODER',
      'Инструменты наблюдения во всех мирах',
      'Право выдавать базовые наказания',
    ],
    price: 449,
    oldPrice: 599,
    accent: '#818cf8',
    accentSoft: 'rgba(129,140,248,0.14)',
  },
  {
    slug: 'dmladmin',
    tier: 11,
    name: 'D.ML.ADMIN',
    tagline: 'Правая рука короны',
    description:
      'Проведение ивентов и мини-игр: вы задаёте сценарий, арена и награды уже под вашим контролем.',
    inherits: 'dglmoder',
    own: ['Префикс D.ML.ADMIN', 'Запуск ивентов и мини-игр', 'Доступ к настройкам ивент-арены'],
    price: 599,
    oldPrice: 799,
    accent: '#c084fc',
    accentSoft: 'rgba(192,132,252,0.14)',
  },
  {
    slug: 'dadmin',
    tier: 12,
    name: 'D.ADMIN',
    tagline: 'Полномочия без компромиссов',
    description:
      'Красный префикс, управление составом модерации и доступ к экономике: уровень администратора сервера.',
    inherits: 'dmladmin',
    own: [
      'Красный префикс D.ADMIN',
      'Управление составом модерации',
      'Доступ к экономике и админ-складу',
    ],
    price: 799,
    oldPrice: 1099,
    accent: '#ef4444',
    accentSoft: 'rgba(239,68,68,0.14)',
  },
  {
    slug: 'opka',
    tier: 13,
    name: 'OPKA',
    tagline: 'Неоновый ультиматум',
    description:
      'Неоновый ореол и двадцать точек дома. Максимальная визуальная мощь для тех, кто хочет выделяться всегда.',
    inherits: 'dadmin',
    own: ['Неоновый префикс OPKA', '20 точек /sethome', 'Уникальный неоновый ореол'],
    price: 999,
    oldPrice: 1399,
    accent: '#2dd4bf',
    accentSoft: 'rgba(45,212,191,0.16)',
  },
  {
    slug: 'downer',
    tier: 14,
    name: 'D.OWNER',
    tagline: 'Максимальная привилегия',
    description:
      'Владелец империи. Абсолютная вершина KingGrief: радужный префикс, 3D-корона, золотые частицы и максимальные лимиты на всё.',
    inherits: 'opka',
    own: [
      'Радужный префикс D.OWNER',
      '3D-корона над персонажем',
      'Безлимитные /sethome',
      'Золотые частицы и аура владельца',
      'Доступ к закрытому совету сервера',
      'Персональный менеджер поддержки',
    ],
    price: 1499,
    oldPrice: 1999,
    accent: '#fbbf24',
    accentSoft: 'rgba(251,191,36,0.2)',
  },
];

export const BY_SLUG = new Map(PRIVILEGES.map((item) => [item.slug, item]));

export function getPrivilege(slug: string): Privilege | undefined {
  return BY_SLUG.get(slug);
}

/** Цепочка наследования от базового уровня к текущему. */
export function inheritanceChain(slug: string): Privilege[] {
  const chain: Privilege[] = [];
  let current = BY_SLUG.get(slug);
  const guard = new Set<string>();
  while (current && !guard.has(current.slug)) {
    guard.add(current.slug);
    chain.unshift(current);
    current = current.inherits ? BY_SLUG.get(current.inherits) : undefined;
  }
  return chain;
}

/**
 * Количество пунктов на странице уровня: «Всё из PARENT» (1) + собственные.
 * Для базового уровня наследования нет, поэтому только собственные пункты.
 */
export function capabilityCount(slug: string): number {
  const item = BY_SLUG.get(slug);
  if (!item) return 0;
  return item.own.length + (item.inherits ? 1 : 0);
}

/** Сколько новых возможностей даёт уровень сверх предыдущего. */
export function newCapabilityCount(slug: string): number {
  return BY_SLUG.get(slug)?.own.length ?? 0;
}

/** Полный список возможностей с учётом всей цепочки наследования. */
export function fullCapabilities(slug: string): string[] {
  const item = BY_SLUG.get(slug);
  if (!item) return [];
  const chain = inheritanceChain(slug);
  const root = chain[0];
  const result: string[] = [];
  for (const level of chain) {
    if (level.slug === item.slug) {
      if (item.inherits) result.push(`Всё из ${BY_SLUG.get(item.inherits)?.name ?? ''}`.trim());
      result.push(...level.own);
    }
  }
  if (!item.inherits && root) return [...root.own];
  return result;
}

/** Суммарное число уникальных возможностей по всей цепочке (для сравнения). */
export function cumulativeFeatureCount(slug: string): number {
  return inheritanceChain(slug).reduce((sum, level) => sum + level.own.length, 0);
}

export function discountPercent(price: number, oldPrice: number): number {
  if (oldPrice <= price) return 0;
  return Math.round((1 - price / oldPrice) * 100);
}

export const TOP_SLUGS = ['king', 'god', 'opka', 'downer'];

export function topPrivileges(): Privilege[] {
  return TOP_SLUGS.map((slug) => BY_SLUG.get(slug)).filter((item): item is Privilege => Boolean(item));
}

export function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}
