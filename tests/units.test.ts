/**
 * Юнит-тесты на места, где раньше были баги.
 * Запуск: npm test  (node --test --experimental-strip-types)
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CASES,
  dropChance,
  dropLabel,
  packDiscount,
  pricePerKey,
  topDrops,
  validateCases,
  weightSum,
} from '../lib/cases.ts';
import {
  capabilityCount,
  cumulativeFeatureCount,
  discountPercent,
  fullCapabilities,
  getPrivilege,
  inheritanceChain,
} from '../lib/catalog.ts';
import { parseItemParam, priceCart } from '../lib/pricing.ts';
import { RELIC_PACKS, formatPerThousand, relicPrice } from '../lib/relics.ts';
import {
  DEFAULT_SETTINGS,
  connectAddress,
  isValidHost,
  splitHostPort,
  validateSettings,
} from '../lib/settings.ts';

const valid = {
  ...DEFAULT_SETTINGS,
  serverIp: 'play.kinggrief.net',
  serverPort: 25565,
};

/* --------------------------- настройки / IP --------------------------- */

test('валидный домен и IPv4 проходят', () => {
  assert.equal(isValidHost('play.kinggrief.net'), true);
  assert.equal(isValidHost('mc.example.com'), true);
  assert.equal(isValidHost('1.2.3.4'), true);
});

test('мусор в IP отвергается', () => {
  for (const bad of ['http://play.kinggrief.net', 'play kinggrief', 'play.kinggrief.net/x', '', '-bad.net', '999.1.1.1']) {
    assert.equal(isValidHost(bad), false, `должно быть невалидно: ${bad}`);
  }
});

test('адрес вида host:port разбирается на хост и порт', () => {
  assert.deepEqual(splitHostPort('mc.example.net:25566'), { host: 'mc.example.net', port: 25566 });
  assert.deepEqual(splitHostPort('mc.example.net'), { host: 'mc.example.net', port: null });
});

test('валидация принимает host:port в поле IP (раньше это ломало сохранение)', () => {
  const result = validateSettings({ ...valid, serverIp: 'mc.example.net:25566' }, 'test');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.serverIp, 'mc.example.net');
    assert.equal(result.value.serverPort, 25566);
  }
});

test('невалидный IP не сохраняется и возвращает ошибку по полю', () => {
  const result = validateSettings({ ...valid, serverIp: 'http://bad host' }, 'test');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.serverIp);
});

test('порт вне диапазона отвергается', () => {
  const result = validateSettings({ ...valid, serverPort: 70000 }, 'test');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.serverPort);
});

test('онлайн больше максимума отвергается', () => {
  const result = validateSettings({ ...valid, onlinePlayers: 100, maxPlayers: 10 }, 'test');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.onlinePlayers);
});

test('пустой обязательный бренд даёт понятную ошибку', () => {
  const result = validateSettings({ ...valid, brand: '   ' }, 'test');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.brand ?? '', /не может быть пустым/);
});

test('адрес для игроков не печатает стандартный порт', () => {
  assert.equal(connectAddress({ serverIp: 'a.net', serverPort: 25565 }), 'a.net');
  assert.equal(connectAddress({ serverIp: 'a.net', serverPort: null }), 'a.net');
  assert.equal(connectAddress({ serverIp: 'a.net', serverPort: 25566 }), 'a.net:25566');
});

/* ------------------------------ привилегии ---------------------------- */

test('KING: счётчики совпадают во всех представлениях', () => {
  const king = getPrivilege('king');
  assert.ok(king);
  // 5 собственных + «Всё из GOD»
  assert.equal(capabilityCount('king'), 6);
  assert.equal(king.own.length, 5);
  // то, что раньше на главной показывалось как «+3», а в списке «+2»
  assert.equal(king.own.length, 5);
  const caps = fullCapabilities('king');
  assert.equal(caps[0], 'Всё из GOD');
  assert.equal(caps.length, 6);
});

test('D.OWNER: 7 пунктов на странице и 6 собственных', () => {
  const owner = getPrivilege('downer');
  assert.ok(owner);
  assert.equal(owner.own.length, 6);
  assert.equal(capabilityCount('downer'), 7);
  assert.equal(fullCapabilities('downer').length, 7);
});

test('наследование: у D.OWNER цепочка из 14 уровней', () => {
  assert.equal(inheritanceChain('downer').length, 14);
  assert.equal(inheritanceChain('pegas').length, 1);
});

test('накопленное число возможностей = сумма собственных по цепочке', () => {
  for (const slug of ['cobra', 'king', 'downer', 'opka']) {
    const expected = inheritanceChain(slug).reduce((sum, level) => sum + level.own.length, 0);
    assert.equal(cumulativeFeatureCount(slug), expected, slug);
  }
});

test('количество возможностей не убывает с уровнем', () => {
  const tiers = ['pegas', 'cobra', 'king', 'dmoder', 'downer'];
  const values = tiers.map((slug) => cumulativeFeatureCount(slug));
  for (let i = 1; i < values.length; i += 1) {
    assert.ok(values[i] >= values[i - 1], `${tiers[i]}: ${values[i]} < ${values[i - 1]}`);
  }
});

test('базовый уровень не содержит «Всё из …»', () => {
  assert.equal(capabilityCount('pegas'), getPrivilege('pegas')?.own.length);
  assert.ok(!fullCapabilities('pegas').some((item) => item.startsWith('Всё из')));
});

test('скидка считается и не бывает отрицательной', () => {
  assert.equal(discountPercent(199, 299), 33);
  assert.equal(discountPercent(100, 100), 0);
  assert.equal(discountPercent(100, 50), 0);
});

/* --------------------------------- кейсы ------------------------------ */

test('сумма шансов каждого кейса ровно 100% (раньше было 88% из 100%)', () => {
  for (const item of CASES) {
    assert.equal(weightSum(item), 100, `${item.slug}: ${weightSum(item)}%`);
  }
});

test('каталог кейсов проходит собственную валидацию', () => {
  const problems = validateCases().flatMap((item) => item.problems);
  assert.deepEqual(problems, []);
});

test('все награды кейса отображаются и дают в сумме 100%', () => {
  for (const item of CASES) {
    const sum = item.drops.reduce((acc, drop) => acc + dropChance(item, drop), 0);
    assert.ok(Math.abs(sum - 100) < 0.0001, `${item.slug}: ${sum}`);
    for (const drop of item.drops) assert.ok(dropLabel(drop).length > 0);
  }
});

test('топ-награды детерминированы и непустые', () => {
  for (const item of CASES) {
    const top = topDrops(item, 3);
    assert.equal(top.length, Math.min(3, item.drops.length));
    assert.deepEqual(top.map(dropLabel), topDrops(item, 3).map(dropLabel));
  }
});

test('цена за ключ округляется вниз (139/2 = 69, а не 70)', () => {
  const pack = { count: 2, price: 139, oldPrice: 158 };
  assert.equal(pricePerKey(pack), 69);
  assert.ok(packDiscount(pack) > 0);
});

/* -------------------------------- рилики ------------------------------ */

test('цена за 1 000 не расходится с ценой пакета', () => {
  for (const pack of RELIC_PACKS) {
    assert.equal(formatPerThousand(pack), `${((pack.price / pack.amount) * 1000).toFixed(2).replace('.', ',')} ₽ за 1 000`);
  }
  assert.equal(formatPerThousand({ amount: 10_000, price: 119 }), '11,90 ₽ за 1 000');
});

test('калькулятор риликов: границы и монотонность', () => {
  // 0 и отрицательные прижимаются к минимуму, а не дают NaN/отрицательную цену
  assert.equal(relicPrice(0), relicPrice(1));
  assert.equal(relicPrice(-500), relicPrice(1));
  assert.ok(relicPrice(1) >= 1);
  assert.ok(relicPrice(1_000_000) > relicPrice(100_000));
  assert.ok(Number.isInteger(relicPrice(12_345)));
});

/* -------------------------------- корзина ----------------------------- */

test('цена берётся с сервера, а не из запроса', () => {
  const priced = priceCart([{ kind: 'privilege', slug: 'king', qty: 1 }]);
  assert.equal(priced.ok, true);
  if (priced.ok) {
    assert.equal(priced.total, 199);
    assert.match(priced.lines[0].title, /KING/);
  }
});

test('неизвестный товар не превращается в бесплатный заказ', () => {
  const priced = priceCart([{ kind: 'privilege', slug: 'free-money', qty: 1 }]);
  assert.equal(priced.ok, false);
});

test('количество ограничено', () => {
  const priced = priceCart([{ kind: 'privilege', slug: 'king', qty: 999 }]);
  assert.equal(priced.ok, true);
  if (priced.ok) assert.equal(priced.lines[0].qty, 20);
});

test('набор кейса с несуществующим количеством ключей отвергается', () => {
  const priced = priceCart([{ kind: 'case', slug: 'super', packCount: 7, qty: 1 }]);
  assert.equal(priced.ok, false);
});

test('параметр ссылки разбирается в позицию корзины', () => {
  assert.deepEqual(parseItemParam('king'), { kind: 'privilege', slug: 'king', qty: 1 });
  assert.deepEqual(parseItemParam('relics:25000'), { kind: 'relics', amount: 25_000, qty: 1 });
  assert.equal(parseItemParam('nonsense'), null);
  assert.equal(parseItemParam(undefined), null);
});
