#!/usr/bin/env node
/**
 * Каталог в коде не должен врать.
 *
 * Раньше этот файл сверял `src/constants.ts` с базой: запасной каталог обязан
 * был совпадать с боевым, иначе при молчащей базе покупатель видел бы старые
 * цены. С 16 октября каталог живёт в репозитории по решению владельца — база
 * уходит в паузу от простоя, а фотографии и тексты и так лежат в репозитории и
 * уезжают на Vercel сборкой. Значит, сверять каталог больше не с чем, кроме
 * самого себя и файлов на диске, и проверять надо именно это.
 *
 * Главная проба — «каждый путь ведёт к файлу». Она появилась не зря: 16 октября
 * в каталог уехали пути `/products/1.jpg` вместо `/products/01.jpg`, три фото из
 * четырёх перестали открываться, и ни одна проверка этого не заметила.
 *
 *   node scripts/check-catalog-sync.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log('  ✓', name); return; }
  failed += 1;
  console.error('  ✗', name, detail ? `— ${detail}` : '');
};

const source = readFileSync('src/constants.ts', 'utf8');

/** Раскодировать escape-последовательности строки в коде: \n, \' и \\. */
const unquote = (raw) => raw.replace(/\\(.)/g, (_, ch) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : ch));

/** Разбор товаров из исходника: по блоку на товар, чтобы поля не перемешались. */
const products = [...source.matchAll(/\{\s*id: '([^']+)',([\s\S]*?)\n  \},/g)].map(([, id, body]) => ({
  id,
  name: unquote(body.match(/name: '((?:[^'\\]|\\.)*)'/)?.[1] ?? ''),
  price: Number(body.match(/price: (\d+)/)?.[1] ?? 0),
  description: unquote(body.match(/description: '((?:[^'\\]|\\.)*)'/)?.[1] ?? ''),
  images: [...(body.match(/images: \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]),
}));

check('каталог в коде не пуст', products.length > 0, `товаров: ${products.length}`);

const ids = products.map((p) => p.id);
check('артикулы не повторяются', new Set(ids).size === ids.length,
  `повторы: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);

for (const product of products) {
  const where = `${product.id} (${product.name || 'без имени'})`;
  check(`${where}: имя заполнено`, product.name.length > 0);
  check(`${where}: цена — целое положительное число`, Number.isInteger(product.price) && product.price > 0, `цена ${product.price}`);
  check(`${where}: описание заполнено`, product.description.length > 0);
  check(`${where}: есть хотя бы одна фотография`, product.images.length > 0);
}

// Главная проба: путь обязан вести к файлу, который реально лежит в репозитории.
const allImages = products.flatMap((p) => p.images);
check('фотографии в каталоге вообще есть', allImages.length > 0, `путей: ${allImages.length}`);

const missing = allImages.filter((path) => !existsSync(`public${path}`));
check(
  'каждый путь к фотографии ведёт к файлу в репозитории',
  missing.length === 0,
  `нет файлов: ${missing.join(', ')}`,
);

const notProducts = allImages.filter((path) => !path.startsWith('/products/'));
check('все фотографии лежат в /products/', notProducts.length === 0, `чужие пути: ${notProducts.join(', ')}`);

// Дубли внутри одного товара — не поломка, но покупатель листает одно и то же.
for (const product of products) {
  const unique = new Set(product.images);
  check(`${product.id}: кадры не повторяются`, unique.size === product.images.length,
    `кадров ${product.images.length}, уникальных ${unique.size}`);
}

if (failed) {
  console.error(`\nПровалов: ${failed}`);
  process.exit(1);
}
console.log(`\nКаталог в коде цел: ${products.length} товаров, ${allImages.length} фотографий, все файлы на месте.`);
