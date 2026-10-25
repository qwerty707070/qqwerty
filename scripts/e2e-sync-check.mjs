#!/usr/bin/env node
/**
 * E2E-проверка сценария «админка → сайт».
 *
 * Запуск: node scripts/e2e-sync-check.mjs [baseUrl]
 * Переменные: ADMIN_PASSWORD (по умолчанию kinggrief)
 *
 * Покрывает баги, из-за которых сохранение «не работало»:
 *  1. кука сессии с флагом Secure по HTTP — браузер её выбрасывает;
 *  2. PUT с частичным набором полей;
 *  3. понятная причина при недоступном хранилище;
 *  4. конфликт версий (409) вместо тихой перезаписи;
 *  5. собственно синхронизация IP на публичной странице;
 *  6. no-store на /api/settings.
 */
const BASE = process.argv[2] ?? process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'kinggrief';
const IS_HTTPS = BASE.startsWith('https://');

let failures = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
const fail = (name, details) => {
  failures += 1;
  console.error(`  ✗ ${name}${details ? ` — ${details}` : ''}`);
};

const getSettings = async () => {
  const res = await fetch(`${BASE}/api/settings`, { cache: 'no-store' });
  return { res, body: await res.json() };
};

async function main() {
  console.log(`E2E: ${BASE}\n`);

  const { body: initial } = await getSettings();
  const original = initial.settings;
  console.log(`Исходный IP: ${original.serverIp}:${original.serverPort ?? '—'}`);
  console.log(`Хранилище: ${initial.backend} (запись ${initial.storage?.writable ? 'есть' : 'НЕТ'})\n`);

  /* --- 1. авторизация --- */
  const unauth = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverIp: 'evil.example.net' }),
  });
  unauth.status === 401 ? ok('PUT без сессии отклонён (401)') : fail('PUT без сессии', `status ${unauth.status}`);

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  if (!login.ok) {
    fail('вход в админку', `status ${login.status} (проверьте ADMIN_PASSWORD)`);
    process.exit(1);
  }

  const setCookie = login.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  const hasSecure = /;\s*Secure/i.test(setCookie);
  if (IS_HTTPS) {
    hasSecure ? ok('кука Secure на HTTPS (правильно)') : fail('кука без Secure на HTTPS');
  } else {
    hasSecure
      ? fail('кука с Secure по HTTP — браузер её выбросит, сохранение вернёт 401')
      : ok('кука без Secure по HTTP (сохранение не сломается)');
  }
  /HttpOnly/i.test(setCookie) ? ok('кука HttpOnly') : fail('кука без HttpOnly');

  /* --- 2. частичный PUT --- */
  const partial = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ tagline: original.tagline }),
  });
  const partialBody = await partial.json().catch(() => ({}));
  partial.ok
    ? ok('частичный PUT (одно поле) принимается')
    : fail('частичный PUT', `status ${partial.status} ${JSON.stringify(partialBody).slice(0, 120)}`);

  /* --- 3. валидация --- */
  const bad = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ serverIp: 'not a host/with space' }),
  });
  const badBody = await bad.json().catch(() => ({}));
  bad.status === 422 && badBody.errors?.serverIp
    ? ok('невалидный IP отклонён (422) с ошибкой по полю')
    : fail('невалидный IP', `status ${bad.status}`);

  const afterBad = await getSettings();
  afterBad.body.settings.serverIp === original.serverIp
    ? ok('после ошибки значение в хранилище не изменилось')
    : fail('после ошибки значение изменилось', afterBad.body.settings.serverIp);

  /* --- 4. сохранение нового адреса (host:port в одном поле) --- */
  const probeHost = 'e2e-probe.kinggrief.net';
  const probePort = 25566;
  const put = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ serverIp: `${probeHost}:${probePort}`, status: 'online' }),
  });
  const putBody = await put.json().catch(() => ({}));
  if (!put.ok) {
    fail('сохранение нового IP', `status ${put.status} ${JSON.stringify(putBody).slice(0, 160)}`);
  } else {
    ok('новый адрес сохранён (host:port в одном поле)');
    putBody.settings?.serverIp === probeHost && putBody.settings?.serverPort === probePort
      ? ok('адрес разобран на хост и порт')
      : fail('адрес разобран неверно', JSON.stringify({ ip: putBody.settings?.serverIp, port: putBody.settings?.serverPort }));
  }

  /* --- 5. публичная страница --- */
  const html = await (await fetch(`${BASE}/`, { cache: 'no-store' })).text();
  html.includes(`${probeHost}:${probePort}`)
    ? ok('главная сразу отдаёт новый адрес с портом')
    : fail('главная не отдаёт новый адрес');
  !html.includes(original.serverIp) ? ok('старого IP на странице нет') : fail('на странице остался старый IP');

  const { res: apiRes, body: apiBody } = await getSettings();
  apiBody.settings.serverIp === probeHost ? ok('/api/settings отдаёт новый IP') : fail('/api/settings устарел');
  /no-store/.test(apiRes.headers.get('cache-control') ?? '')
    ? ok('Cache-Control: no-store на /api/settings')
    : fail('нет no-store', apiRes.headers.get('cache-control') || 'пусто');

  /* --- 6. конфликт версий --- */
  const stale = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ serverIp: 'stale.example.net', version: '2000-01-01T00:00:00.000Z' }),
  });
  stale.status === 409 ? ok('устаревшая версия не перетирает чужие правки (409)') : fail('конфликт версий', `status ${stale.status}`);

  /* --- 7. самодиагностика хранилища --- */
  const verifyUnauth = await fetch(`${BASE}/api/settings/verify`, { method: 'POST' });
  verifyUnauth.status === 401
    ? ok('диагностика хранилища закрыта без сессии (401)')
    : fail('диагностика хранилища открыта без сессии', `status ${verifyUnauth.status}`);
  const verify = await fetch(`${BASE}/api/settings/verify`, {
    method: 'POST',
    headers: { cookie },
    cache: 'no-store',
  });
  const verifyBody = await verify.json().catch(() => ({}));
  verifyBody.ok
    ? ok(`круг «запись → чтение» пройден (${verifyBody.roundTripMs} мс)`)
    : fail('самодиагностика хранилища', verifyBody.error ?? `status ${verify.status}`);

  /* --- 8. восстановление --- */
  const restore = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ ...original, force: true }),
  });
  restore.ok ? ok('исходные настройки восстановлены') : fail('не удалось восстановить настройки');

  const finalHtml = await (await fetch(`${BASE}/`, { cache: 'no-store' })).text();
  finalHtml.includes(original.serverIp) ? ok('главная снова показывает исходный IP') : fail('исходный IP не вернулся');

  console.log(`\n${failures === 0 ? 'ВСЁ ЗЕЛЁНОЕ' : `ПРОВАЛОВ: ${failures}`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('E2E упал:', error);
  process.exit(1);
});
