#!/usr/bin/env node
/**
 * E2E-проверка главного сценария: «поменял в админке — видно на сайте».
 *
 * Запуск: node scripts/e2e-sync-check.mjs [baseUrl]
 * Переменные: ADMIN_PASSWORD (по умолчанию kinggrief)
 *
 * Проверяет:
 *  1. публичная страница отдаёт IP из хранилища;
 *  2. PUT без авторизации → 401;
 *  3. PUT с невалидным IP → 422 и значение НЕ меняется;
 *  4. PUT с валидным IP → страница сразу отдаёт новый адрес и не отдаёт старый;
 *  5. /api/settings отдаёт no-store (иначе CDN вернёт старое значение);
 *  6. исходное значение восстанавливается.
 */
const BASE = process.argv[2] ?? process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'kinggrief';

let failures = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
const fail = (name, details) => {
  failures += 1;
  console.error(`  ✗ ${name}${details ? ` — ${details}` : ''}`);
};

async function getSettings() {
  const res = await fetch(`${BASE}/api/settings`, { cache: 'no-store' });
  return { res, body: await res.json() };
}

async function main() {
  console.log(`E2E: ${BASE}\n`);

  const { body: initial } = await getSettings();
  const original = initial.settings;
  console.log(`Исходный IP: ${original.serverIp}:${original.serverPort ?? '—'}\n`);

  // 2. без авторизации
  const unauth = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(original),
  });
  unauth.status === 401 ? ok('PUT без сессии отклонён (401)') : fail('PUT без сессии', `status ${unauth.status}`);

  // логин
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  if (!login.ok) {
    fail('вход в админку', `status ${login.status} (проверьте ADMIN_PASSWORD)`);
    process.exit(1);
  }
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  ok('вход в админку выполнен');

  // 3. невалидный IP
  const bad = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ ...original, serverIp: 'not a host/with space' }),
  });
  const badBody = await bad.json().catch(() => ({}));
  if (bad.status === 422 && badBody.errors?.serverIp) ok('невалидный IP отклонён (422)');
  else fail('невалидный IP', `status ${bad.status}`);

  const afterBad = await getSettings();
  afterBad.body.settings.serverIp === original.serverIp
    ? ok('после ошибки значение в хранилище не изменилось')
    : fail('после ошибки значение изменилось', afterBad.body.settings.serverIp);

  // 4. валидный новый IP
  const probeIp = 'e2e-probe.kinggrief.net';
  const probePort = 25566;
  const put = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ ...original, serverIp: probeIp, serverPort: probePort, status: 'online' }),
  });
  if (!put.ok) {
    fail('сохранение нового IP', `status ${put.status}`);
  } else {
    ok('новый IP сохранён');
  }

  const html = await (await fetch(`${BASE}/`, { cache: 'no-store' })).text();
  html.includes(probeIp) ? ok('публичная страница отдаёт НОВЫЙ IP') : fail('главная не отдаёт новый IP');
  html.includes(`${probeIp}:${probePort}`)
    ? ok('нестандартный порт показан как host:port')
    : fail('порт не отображается');
  !html.includes(original.serverIp)
    ? ok('старого IP на странице нет')
    : fail('на странице остался старый IP');

  const { res: apiRes, body: apiBody } = await getSettings();
  apiBody.settings.serverIp === probeIp ? ok('/api/settings отдаёт новый IP') : fail('/api/settings устарел');
  const cacheControl = apiRes.headers.get('cache-control') ?? '';
  /no-store/.test(cacheControl)
    ? ok('Cache-Control: no-store на /api/settings')
    : fail('нет no-store', cacheControl || 'пусто');

  // 6. восстановление
  const restore = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(original),
  });
  restore.ok ? ok('исходные настройки восстановлены') : fail('не удалось восстановить настройки');

  console.log(`\n${failures === 0 ? 'ВСЁ ЗЕЛЁНОЕ' : `ПРОВАЛОВ: ${failures}`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('E2E упал:', error);
  process.exit(1);
});
