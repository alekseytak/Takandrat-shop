#!/usr/bin/env node
/**
 * Что уезжает покупателю в браузерном бандле.
 *
 * Витрина собирается Vite, а Vite отдаёт клиенту всё, что начинается с `VITE_`.
 * Vercel по умолчанию заводит системные переменные с этим же префиксом — и среди
 * них `VITE_VERCEL_GIT_COMMIT_MESSAGE`, то есть текст последнего коммита целиком.
 * Так внутренняя проза попадала в бандл, который скачивает каждый посетитель: в
 * сборке от 20 сентября лежало 19 таких переменных. Авто-выдача выключена в
 * настройках проекта (`autoExposeSystemEnvs`), а эта проверка следит, чтобы
 * утечка не вернулась — от нового коммита, от смены настроек или от секрета,
 * случайно попавшего в код.
 *
 * Смотреть надо на собранный бандл, а не на переменные окружения: локально
 * системных переменных Vercel нет вовсе, поэтому зелёная проверка на этой машине
 * ничего бы не доказывала. Собирать обязательно — тогда проверка краснеет и на
 * боевом, и в CI, и здесь.
 *
 * Запуск: npm run check:bundle (при отсутствии dist собирает сам).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const assetsDir = path.join(distDir, 'assets');

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

/** Что не должно оказаться в браузере ни при каких обстоятельствах. */
const FORBIDDEN = [
  { what: 'системная переменная Vercel', marker: 'VITE_VERCEL_' },
  { what: 'текст коммита в бандле', marker: 'GIT_COMMIT_MESSAGE' },
  { what: 'имя автора коммита в бандле', marker: 'GIT_COMMIT_AUTHOR' },
  { what: 'служебная роль Supabase', marker: 'service_role' },
  { what: 'ключ OpenRouter', marker: 'sk-or-v1-' },
];

if (!existsSync(assetsDir)) {
  console.log('  собранного бандла нет — собираю (npm run build)');
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
}

if (!existsSync(assetsDir)) {
  console.error('  БЕДА сборка не оставила dist/assets — проверять нечего');
  process.exit(1);
}

const scripts = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
console.log(`Проверка бандла: ${scripts.length} файл(ов) в dist/assets\n`);

if (scripts.length === 0) {
  bad('в dist/assets нет js — сборка пустая');
} else {
  const totalBytes = scripts.reduce(
    (sum, name) => sum + readFileSync(path.join(assetsDir, name)).length,
    0,
  );
  ok('бандл собран', `${scripts.join(', ')} — ${Math.round(totalBytes / 1024)} КБ`);
}

for (const { what, marker } of FORBIDDEN) {
  const guilty = [];
  for (const name of scripts) {
    const text = readFileSync(path.join(assetsDir, name), 'utf8');
    if (text.includes(marker)) guilty.push(name);
  }
  if (guilty.length === 0) {
    ok(`в бандле нет: ${what}`);
  } else {
    bad(`в бандле оказалось: ${what}`, `${marker} в ${guilty.join(', ')}`);
  }
}

// Проверка бесполезна, если не может упасть: убеждаемся, что она вообще читает
// непустой текст, а не пустые файлы.
const biggest = scripts
  .map((name) => ({ name, text: readFileSync(path.join(assetsDir, name), 'utf8') }))
  .sort((a, b) => b.text.length - a.text.length)[0];
if (biggest && biggest.text.includes('Здравствуйте')) {
  ok('бандл читается и содержит витрину', `строка приветствия найдена в ${biggest.name}`);
} else {
  bad('бандл не похож на витрину', 'в самом большом файле нет текста магазина');
}

console.log(`\nпройдено: ${passed}, провалено: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
