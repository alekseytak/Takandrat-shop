#!/usr/bin/env node
/**
 * Запасной каталог в коде обязан совпадать с базой.
 *
 * `src/constants.ts` — это копия каталога на случай молчащей базы, а не второй
 * источник правды. Пока в нём стояли старые имена и цены, недоступная база
 * показывала покупателю неправду, и заметить это можно было только глазами.
 *
 *   node scripts/check-catalog-sync.mjs
 */
import { readFileSync } from 'node:fs';

const readEnv = (path) => {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* нет .env — ниже скажем об этом */ }
  return out;
};

const env = readEnv('.env');
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Нет .env с адресом и публичным ключом базы — сверять не с чем.');
  process.exit(1);
}

const response = await fetch(`${url}/rest/v1/products?select=name,price,description&is_visible=eq.true&order=id`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!response.ok) {
  console.error('База не отдала каталог:', response.status, await response.text());
  process.exit(1);
}
const rows = await response.json();

const source = readFileSync('src/constants.ts', 'utf8');
// Раскодировать escape-последовательности строки в коде: \n, \' и \\.
// Без этого многострочное описание в файле не совпадёт с текстом из базы.
const unquote = (raw) => raw.replace(/\\(.)/g, (_, ch) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : ch));
const names = [...source.matchAll(/name: '((?:[^'\\]|\\.)*)'/g)].map((m) => unquote(m[1]));
const prices = [...source.matchAll(/price: (\d+)/g)].map((m) => Number(m[1]));
const descriptions = [...source.matchAll(/description: '((?:[^'\\]|\\.)*)'/g)].map((m) => unquote(m[1]));

let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log('  ✓', name); return; }
  failed += 1;
  console.error('  ✗', name, detail ? `— ${detail}` : '');
};

check('в базе есть товары на витрине', rows.length > 0, `товаров: ${rows.length}`);
check('в запасном каталоге столько же товаров, сколько на витрине',
  names.length === rows.length, `в коде ${names.length}, в базе ${rows.length}`);

for (const [index, row] of rows.entries()) {
  const where = `товар ${index + 1} (${row.name})`;
  check(`${where}: имя совпадает`, names[index] === row.name, `в коде «${names[index] ?? '—'}»`);
  check(`${where}: цена совпадает`, prices[index] === Number(row.price),
    `в коде ${prices[index] ?? '—'}, в базе ${Number(row.price)}`);
  check(`${where}: описание совпадает`, descriptions[index] === row.description,
    'тексты разошлись — обновить вместе с базой');
}

if (failed) {
  console.error(`\nРасхождений: ${failed}`);
  process.exit(1);
}
console.log(`\nЗапасной каталог совпадает с базой: ${rows.length} товара.`);
