#!/usr/bin/env node
/**
 * Читает текст портфолио владельца: голос бренда лежит там, а не в репозитории.
 *
 * Страница рисуется скриптом, поэтому в исходном HTML текста нет — нужен
 * браузер. Берём тот же Chrome, что и проверки витрины, и просим отдать DOM
 * после выполнения скриптов. Из выдачи выбрасываем служебные надписи
 * терминала, оставляя человеческую прозу.
 *
 *   node tools/portfolio-text.mjs [адрес]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const DEFAULT_URL = 'https://portfolio-rho-two-lptgirc7rz.vercel.app/';
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chrome = CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error('Не нашёл браузер: укажите CHROME_PATH');
  process.exit(1);
}

const url = process.argv[2] || DEFAULT_URL;
const dom = spawnSync(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--dump-dom', '--virtual-time-budget=15000', url,
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

if (dom.status !== 0 || !dom.stdout) {
  console.error('Браузер не отдал страницу:', dom.stderr?.split('\n').slice(-3).join(' | ') || 'без объяснений');
  process.exit(1);
}

const text = dom.stdout
  .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const seen = new Set();
for (const raw of text.split('\n')) {
  const line = raw.trim();
  if (line.length < 2 || seen.has(line)) continue;
  // Служебные надписи терминала: заглавные, цифры, подчёркивания, символы.
  if (/^[A-Z0-9_ ./:()[\]—+-]+$/.test(line)) continue;
  if ((line.match(/[а-яёa-z]{2,}/gi) || []).length < 2) continue;
  seen.add(line);
  console.log(line);
}
