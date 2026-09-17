#!/usr/bin/env node
/**
 * Сжатие фотографий товаров.
 *
 * Оригиналы остаются нетронутыми: это источник правды и то, с чем сверяют
 * изделие. Рядом кладутся сжатые копии в webp, и витрина показывает их —
 * покупателю уходит в разы меньше байт при том же кадре.
 *
 * Изделие не меняется ни на пиксель: ни кадрирования, ни ретуши, ни чистки
 * фона. Всё, что меняет вид товара, — отдельная работа со сверкой с исходником
 * (правило проекта: товар нельзя придумывать).
 *
 * Запуск:
 *   node tools/product-photos.mjs            # сжать всё, чего ещё нет
 *   node tools/product-photos.mjs --force    # пересжать заново
 */

import sharp from 'sharp';
import { readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_DIR = path.join('public', 'products');
const OUTPUT_DIR = path.join(SOURCE_DIR, 'web');
const QUALITY = 82;
const force = process.argv.includes('--force');

const kb = (bytes) => Math.round(bytes / 1024);

const listJpegs = async () => {
  const entries = await readdir(SOURCE_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.jpe?g$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
};

const main = async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const files = await listJpegs();
  if (files.length === 0) {
    console.log('В public/products нет ни одного снимка — обрабатывать нечего.');
    return;
  }

  let beforeTotal = 0;
  let afterTotal = 0;
  let skipped = 0;
  const rows = [];

  for (const file of files) {
    const source = path.join(SOURCE_DIR, file);
    const target = path.join(OUTPUT_DIR, `${path.parse(file).name}.webp`);
    const sourceInfo = await stat(source);
    beforeTotal += sourceInfo.size;

    let targetInfo = null;
    try {
      targetInfo = await stat(target);
    } catch {
      targetInfo = null;
    }

    const isFresh = targetInfo && targetInfo.mtimeMs >= sourceInfo.mtimeMs;
    if (isFresh && !force) {
      skipped += 1;
      afterTotal += targetInfo.size;
      rows.push([file, sourceInfo.size, targetInfo.size, 'уже сжат']);
      continue;
    }

    // Кадр, размер и пропорции сохраняются: меняется только способ сжатия.
    await sharp(source).webp({ quality: QUALITY, effort: 5 }).toFile(target);
    const madeInfo = await stat(target);
    afterTotal += madeInfo.size;
    rows.push([file, sourceInfo.size, madeInfo.size, 'сжат']);
  }

  const width = Math.max(...rows.map((row) => row[0].length));
  for (const [file, before, after, note] of rows) {
    const saved = Math.round((1 - after / before) * 100);
    console.log(
      `  ${file.padEnd(width)}  ${String(kb(before)).padStart(4)} КБ → ${String(kb(after)).padStart(4)} КБ  −${saved}%  ${note}`,
    );
  }
  const savedTotal = Math.round((1 - afterTotal / beforeTotal) * 100);
  console.log(
    `\nСнимков: ${rows.length} (сжато сейчас: ${rows.length - skipped}). ` +
      `Вес: ${kb(beforeTotal)} КБ → ${kb(afterTotal)} КБ, экономия ${savedTotal}%.`,
  );
  console.log(`Копии лежат в ${OUTPUT_DIR}, оригиналы не тронуты.`);
};

main().catch((error) => {
  console.error('Не удалось обработать снимки:', error.message);
  process.exit(1);
});
