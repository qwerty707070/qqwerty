#!/usr/bin/env node
/**
 * Защита от рецидива: проверяет, что «живые» данные не захардкожены
 * в страницах и компонентах. Именно из-за таких копий IP сервера
 * и количества возможностей расходились между админкой и сайтом.
 *
 * Запуск: npm run check:drift  (можно повесить в CI/pre-commit)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const LIB_SETTINGS = path.join(ROOT, 'lib', 'settings.ts');
const LIB_CATALOG = path.join(ROOT, 'lib', 'catalog.ts');
// tests/ содержит адреса как тестовые данные — это не источник для страниц
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.data', 'scripts', 'supabase', 'tests']);

const FORBIDDEN = [
  { pattern: /play\.kinggrief\.net/g, why: 'IP сервера должен приходить из настроек (lib/settings.ts)' },
  { pattern: /@kinggrief\.net/g, why: 'E-mail должен приходить из настроек' },
  { pattern: /discord\.gg\/kinggrief/g, why: 'Ссылка на Discord должна приходить из настроек' },
  { pattern: /t\.me\/kinggrief/g, why: 'Ссылка на Telegram должна приходить из настроек' },
  { pattern: /\+?\d+ возможностей/g, why: 'Количество возможностей вычисляется из каталога, а не пишется в разметке' },
];

// Документация описывает баги и поэтому цитирует значения — её не проверяем.
const ALLOW = new Set([
  LIB_SETTINGS,
  LIB_CATALOG,
  path.join(ROOT, 'BUGREPORT.md'),
  path.join(ROOT, 'README.md'),
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await walk(full)));
      continue;
    }
    if (/\.(tsx?|jsx?|mdx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const problems = [];

for (const file of await walk(ROOT)) {
  if (ALLOW.has(file)) continue;
  if (file.endsWith('scripts/check-content-drift.mjs')) continue;
  const source = await readFile(file, 'utf8');
  for (const rule of FORBIDDEN) {
    const matches = source.match(rule.pattern);
    if (!matches) continue;
    problems.push({
      file: path.relative(ROOT, file),
      count: matches.length,
      why: rule.why,
    });
  }
}

if (problems.length === 0) {
  console.log('✓ Рассинхрона нет: живые данные не захардкожены в компонентах.');
  process.exit(0);
}

console.error('✗ Найдены захардкоженные данные (источник будущего рассинхрона):\n');
for (const problem of problems) {
  console.error(`  ${problem.file} — ${problem.count} совпад.`);
  console.error(`    ${problem.why}`);
}
console.error('\nПеренесите значения в lib/settings.ts (настройки) или lib/catalog.ts (привилегии).');
process.exit(1);
