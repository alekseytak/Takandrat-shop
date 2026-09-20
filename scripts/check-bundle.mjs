#!/usr/bin/env node
/**
 * Что уезжает покупателю в браузерном бандле.
 *
 * Витрина собирается Vite, а Vite отдаёт клиенту всё, что начинается с `VITE_`.
 * Vercel по умолчанию заводит системные переменные с этим же префиксом — и среди
 * них `VITE_VERCEL_GIT_COMMIT_MESSAGE`, то есть текст последнего коммита целиком.
 * Так внутренняя проза попадала в бандл, который скачивает каждый посетитель: в
 * сборке от 20 сентября лежало 19 таких переменных. Авто-выдача выключена в
 * настройках проекта (`autoExposeSystemEnvs: false`), а эта проверка следит,
 * чтобы утечка не вернулась — от нового коммита, от смены настроек или от
 * секрета, случайно попавшего в код.
 *
 * Проверять надо БОЕВОЙ бандл, а не локальную сборку: локально системных
 * переменных Vercel нет вовсе, и зелёная проверка здесь ничего не доказывала бы.
 * Поэтому:
 *
 *   npm run check:bundle                                  # локальная сборка (dist)
 *   SHOP_URL=https://takandrat-shop.vercel.app npm run check:bundle   # что скачивает покупатель
 *
 * Локальная сборка без dist собирается сама — иначе проверке нечего смотреть.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const shopUrl = (process.env.SHOP_URL || '').replace(/\/+$/, '');

let passed = 0;
let failed = 0;

const ok = (what, detail = '') => {
  passed += 1;
  console.log(`  ок   ${what}${detail ? `\n        ${detail}` : ''}`);
};
const bad = (what, detail = '') => {
  failed += 1;
  console.log(`  БЕДА ${what}${detail ? `\n        ${detail}` : ''}`);
};

/**
 * Системные переменные Vercel, которые в бандле безобидны: это настройка
 * подключённой аналитики, и без неё она не работает. Всё остальное с этим
 * префиксом — утечка, в том числе незнакомая: пусть лучше проверка покраснеет и
 * спросит человека, чем промолчит.
 */
const HARMLESS_SYSTEM_VARS = new Set(['VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG']);

/** Строки, которых в браузере быть не должно ни под каким именем. */
const FORBIDDEN = [
  { what: 'текст коммита', marker: 'GIT_COMMIT_MESSAGE' },
  { what: 'имя автора коммита', marker: 'GIT_COMMIT_AUTHOR' },
  { what: 'служебная роль Supabase', marker: 'service_role' },
  { what: 'ключ OpenRouter', marker: 'sk-or-v1-' },
];

/** Собрать бандлы: с боевого адреса или из локальной сборки. */
async function loadBundles() {
  if (shopUrl) {
    const page = await fetch(`${shopUrl}/`);
    if (!page.ok) throw new Error(`витрина ответила ${page.status}`);
    const html = await page.text();
    const names = [...new Set(html.match(/assets\/[A-Za-z0-9._-]+\.js/g) || [])];
    if (names.length === 0) throw new Error('на странице нет ссылок на js-бандл');
    const bundles = [];
    for (const name of names) {
      const res = await fetch(`${shopUrl}/${name}`);
      if (!res.ok) throw new Error(`${name}: витрина ответила ${res.status}`);
      bundles.push({ name, text: await res.text() });
    }
    return { source: `боевой адрес ${shopUrl}`, bundles };
  }

  const assetsDir = path.join(root, 'dist', 'assets');
  if (!existsSync(assetsDir)) {
    console.log('  собранного бандла нет — собираю (npm run build)');
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  }
  if (!existsSync(assetsDir)) throw new Error('сборка не оставила dist/assets');
  const names = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
  return {
    source: 'локальная сборка dist/assets',
    bundles: names.map((name) => ({
      name,
      text: readFileSync(path.join(assetsDir, name), 'utf8'),
    })),
  };
}

const { source, bundles } = await loadBundles();
console.log(`Проверка бандла: ${source}, файлов ${bundles.length}\n`);

if (bundles.length === 0) {
  bad('js-файлов нет — проверять нечего');
} else {
  const bytes = bundles.reduce((sum, b) => sum + b.text.length, 0);
  ok('бандл получен', `${bundles.map((b) => b.name).join(', ')} — ${Math.round(bytes / 1024)} КБ`);
}

for (const { what, marker } of FORBIDDEN) {
  const guilty = bundles.filter((b) => b.text.includes(marker)).map((b) => b.name);
  if (guilty.length === 0) ok(`в бандле нет: ${what}`);
  else bad(`в бандле оказалось: ${what}`, `${marker} в ${guilty.join(', ')}`);
}

// Все системные переменные Vercel, кроме заведомо безобидных.
const systemVars = new Map();
for (const b of bundles) {
  for (const name of b.text.match(/VITE_VERCEL_[A-Z0-9_]+/g) || []) {
    if (!HARMLESS_SYSTEM_VARS.has(name)) systemVars.set(name, b.name);
  }
}
if (systemVars.size === 0) {
  ok('системных переменных Vercel в бандле нет', `безобидные не в счёт: ${[...HARMLESS_SYSTEM_VARS].join(', ')}`);
} else {
  bad(
    'в бандле оказались системные переменные Vercel',
    [...systemVars].map(([name, file]) => `${name} в ${file}`).join('; '),
  );
}

// Проверка бесполезна, если читает пустые файлы: убеждаемся, что это витрина.
const biggest = [...bundles].sort((a, b) => b.text.length - a.text.length)[0];
if (biggest && biggest.text.includes('Здравствуйте')) {
  ok('бандл читается и содержит витрину', `строка приветствия найдена в ${biggest.name}`);
} else {
  bad('бандл не похож на витрину', 'в самом большом файле нет текста магазина');
}

console.log(`\nпройдено: ${passed}, провалено: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
