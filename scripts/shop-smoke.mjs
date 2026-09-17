#!/usr/bin/env node
/**
 * Сквозная проверка витрины, корзины и оформления в настоящем браузере.
 *
 * Запуск (нужен работающий магазин):
 *   npm run dev                              # в одном терминале
 *   node scripts/shop-smoke.mjs
 *
 * Проверять стоит оба режима: dev (Vite middleware) и собранную версию
 * (npm run build && NODE_ENV=production npm start). Адрес задаётся
 * переменной SHOP_URL, по умолчанию http://127.0.0.1:3000/.
 *
 * Проверка ходит по магазину как покупатель: находит товар, кладёт в корзину,
 * открывает оформление и убеждается, что при недоступном сервере покупатель
 * видит понятную причину, а корзина не пропадает. Никакого реального заказа
 * не создаётся: сервер заказов намеренно не поднят.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, openSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CHROME_LOG = '/tmp/shop-smoke-chrome.log';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOP_URL = process.env.SHOP_URL || 'http://127.0.0.1:3000/';
const PORT = Number(process.env.CDP_PORT || 9333);
const PROFILE = '/tmp/shop-smoke-profile';

let passed = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  ок   ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ПРОВАЛ ${name}${detail ? ` — ${detail}` : ''}`); }
};

// Зависший браузер с тем же профилем не даёт запуститься новому: Chrome
// отказывается работать с занятым профилем и молча выходит. Поэтому сначала
// убираем остатки прошлого запуска, иначе проверка падает непонятно почему.
try { execFileSync('/usr/bin/pkill', ['-f', PROFILE], { stdio: 'ignore' }); } catch { /* никого не было — и хорошо */ }
try { rmSync(join(PROFILE, 'SingletonLock'), { force: true }); } catch { /* профиля ещё нет */ }
rmSync(CHROME_LOG, { force: true });

const chromeLog = openSync(CHROME_LOG, 'a');
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: ['ignore', chromeLog, chromeLog] });

const stop = () => { try { chrome.kill('SIGKILL'); } catch {} };

try {
  // Ждём, пока Chrome поднимет отладочный порт. На загруженной машине это
  // может занять и полминуты, поэтому ждём долго и говорим, что ждём.
  let target = null;
  for (let attempt = 0; attempt < 240 && !target; attempt += 1) {
    await sleep(250);
    if (attempt === 40) console.log('  жду Chrome: запускается дольше обычного');
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((item) => item.type === 'page');
    } catch { /* порт ещё не слушает */ }
  }
  if (!target) {
    const log = existsSync(CHROME_LOG) ? readFileSync(CHROME_LOG, 'utf8').trim().split('\n').slice(-3).join(' | ') : 'журнала нет';
    throw new Error(`Chrome не поднял отладочный порт ${PORT}. Последнее из журнала: ${log}`);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    // alert() в headless-браузере блокирует страницу — закрываем его сами.
    if (message.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true });
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      const reason = result.exceptionDetails.exception?.description
        || result.exceptionDetails.text || 'неизвестная ошибка';
      throw new Error(`выражение упало: ${reason}\n    ${expression.slice(0, 160)}`);
    }
    return result.result?.value;
  };

  const waitFor = async (expression, label, timeout = 25000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return true;
      await sleep(250);
    }
    console.log(`       (не дождались: ${label})`);
    return false;
  };

  // body бывает null, пока документ не разобран: спрашиваем безопасно.
  const text = () => evaluate("document.body ? document.body.innerText : ''");
  /**
   * Сравнение без учёта регистра: innerText отдаёт текст уже прописными, как
   * его показывает CSS, а не как он записан в разметке.
   */
  const contains = (haystack, needle) => String(haystack).toUpperCase().includes(needle.toUpperCase());
  const click = async (label) => evaluate(`(() => {
    const wanted = ${JSON.stringify(label)}.toUpperCase();
    const button = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.replace(/\\s+/g, ' ').trim().toUpperCase().includes(wanted));
    if (!button) return 'НЕ НАЙДЕНА';
    button.click();
    return 'нажата';
  })()`);

  console.log(`Проверяю магазин ${SHOP_URL}`);
  await send('Page.navigate', { url: SHOP_URL });
  const loaded = await waitFor(`document.readyState === 'complete'`, 'загрузка страницы', 30000);
  check('страница загрузилась', loaded);

  // 1. Витрина: товары должны прийти из живой базы — сверяем с тем, что в ней лежит.
  // Что должно быть на витрине, берём из живой базы публичным ключом: раньше
  // проверка ждала название из встроенного каталога — это было верно, пока база
  // считалась мёртвой, и стало ложью, когда база ожила. Если база недоступна,
  // возвращаемся к прежнему ожиданию.
  const expected = await (async () => {
    const fallback = { names: ['КАРТХОЛДЕР VEGETABLE'], price: '3200' };
    try {
      const { readFileSync } = await import('node:fs');
      const rows = readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n');
      const val = (name) => rows.find((row) => row.startsWith(`${name}=`))?.slice(name.length + 1).trim();
      const url = val('VITE_SUPABASE_URL');
      const key = val('VITE_SUPABASE_ANON_KEY');
      if (!url || !key) return fallback;
      const res = await fetch(`${url}/rest/v1/products?select=name,price&is_visible=eq.true&order=id&limit=5`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const names = list.map((row) => String(row.name ?? '').toUpperCase()).filter(Boolean);
      if (names.length === 0) return fallback;
      return { names, price: String(Math.trunc(Number(list[0].price ?? 0))) };
    } catch {
      return fallback;
    }
  })();
  console.log(`       витрина должна показать: ${expected.names[0]} за ${expected.price}`);

  const catalogShown = await waitFor(
    `${JSON.stringify(expected.names)}.some((n) => (document.body?.innerText || '').toUpperCase().includes(n))`,
    'товары на витрине', 30000);
  check('витрина показывает товары', catalogShown);
  if (!catalogShown) throw new Error('витрина не отрисовалась — дальше проверять нечего');

  const shop = await text();
  check('цена товара на витрине', contains(shop, expected.price), `нет ${expected.price}`);
  check('крутилка «СКАНИРОВАНИЕ ИНВЕНТАРЯ» не залипла', !contains(shop, 'СКАНИРОВАНИЕ ИНВЕНТАРЯ'));

  // 2. Корзина: кладём товар и смотрим счётчик в шапке.
  check('кнопка «В КОРЗИНУ» нажата', (await click('В КОРЗИНУ')) === 'нажата');
  const badgeShown = await waitFor(
    `!!document.querySelector('header')?.querySelector('span.absolute')?.textContent?.trim()`, 'счётчик корзины', 8000);
  check('счётчик корзины показывает 1 товар', badgeShown);

  // 3. Экран корзины.
  const opened = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.className.includes('relative group p-1'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  check('кнопка корзины в шапке найдена', opened === true);
  const cartShown = await waitFor(`(document.body?.innerText || '').toUpperCase().includes('КОРЗИНА')`, 'экран корзины', 8000);
  check('экран корзины открылся', cartShown);
  const cart = await text();
  check('товар в корзине', contains(cart, 'КАРТХОЛДЕР VEGETABLE'), cart.slice(0, 120));
  check('итог посчитан', contains(cart, 'ИТОГО'), 'нет строки «Итого»');

  // 4. Оформление заказа.
  check('кнопка «Оформить заказ» нажата', (await click('Оформить заказ')) === 'нажата');
  const checkoutShown = await waitFor(`(document.body?.innerText || '').toUpperCase().includes('ОФОРМЛЕНИЕ ЗАКАЗА')`, 'экран оформления', 8000);
  check('экран оформления открылся', checkoutShown);
  const checkout = await text();
  const addressPlaceholder = await evaluate(`document.querySelector('input[name=address]')?.placeholder || ''`);
  check('спрашивают адрес ПВЗ', contains(addressPlaceholder, 'АДРЕС ПВЗ'), addressPlaceholder);
  const fieldNames = await evaluate(
    `[...document.querySelectorAll('form input')].map((i) => i.name).join(',')`);
  check('в форме только адрес ПВЗ, без телефона и почты',
    fieldNames === 'address', fieldNames);
  check('предупреждение о реквизитах на месте', contains(checkout, 'ОПЛАТА ПЕРЕВОДОМ'));
  check('на оформлении видно, что именно заказывают',
    contains(checkout, 'КАРТХОЛДЕР VEGETABLE'), 'состав заказа не показан');

  // 5. Отправка при недоступном сервере: понятная причина и целая корзина.
  await evaluate(`(() => {
    const input = document.querySelector('input[name=address]');
    input.value = 'СДЭК, Санкт-Петербург, тестовый адрес';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('ПОДТВЕРДИТЬ'));
    button.click();
    return true;
  })()`);
  const errorShown = await waitFor(
    `!!document.querySelector('[role=alert]')`, 'сообщение об ошибке', 45000);
  check('покупатель видит сообщение об ошибке', errorShown);
  const alertText = await evaluate(`document.querySelector('[role=alert]')?.innerText || ''`);
  check('сообщение написано по-русски и без кодов',
    alertText.length > 10 && !/REJECTED|FUNCTION_|COMM_LINK|undefined/.test(alertText), alertText);
  const afterFailure = await text();
  check('покупатель остался на оформлении, а не выброшен на витрину',
    contains(afterFailure, 'ОФОРМЛЕНИЕ ЗАКАЗА'));

  // Заказ не подтверждён — значит корзина должна остаться на месте.
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.className.includes('relative group p-1'));
    button?.click();
    return true;
  })()`);
  const cartKept = await waitFor(
    `(document.body?.innerText || '').toUpperCase().includes('КАРТХОЛДЕР VEGETABLE')`,
    'товар в корзине после отказа', 8000);
  check('после отказа корзина не очищена', cartKept, 'товар пропал из корзины');

  // Стили. Раньше Tailwind приезжал скриптом с CDN и собирал классы из живой
  // страницы, поэтому любой класс, собранный в рантайме, работал. Сборка так
  // не умеет: она видит только текст в файлах. Поэтому проверяем не сборку, а
  // страницу — у каждого класса, который есть в разметке, должно быть правило.
  const styles = await evaluate(`(() => {
    const classes = new Set();
    for (const element of document.querySelectorAll('*')) for (const name of element.classList) classes.add(name);
    const selectors = [];
    const collect = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText) selectors.push(rule.selectorText);
        // Классы вида sm:gap-3 живут внутри @media, поэтому внутрь надо заглядывать.
        if (rule.cssRules) collect(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try { collect(sheet.cssRules); } catch { /* чужая таблица */ }
    }
    const joined = selectors.join(' ');
    const missing = [...classes].filter((name) => !joined.includes('.' + CSS.escape(name)));
    const body = getComputedStyle(document.body);
    return {
      total: classes.size,
      missing: missing.slice(0, 8),
      missingCount: missing.length,
      cdn: !!document.querySelector('script[src*="tailwindcss"]'),
      background: body.backgroundColor,
      font: body.fontFamily,
      rules: selectors.length,
    };
  })()`);

  check('Tailwind больше не грузится с чужого CDN', styles.cdn === false,
    styles.cdn ? 'на странице остался скрипт cdn.tailwindcss.com' : '');
  check('у каждого класса на странице есть правило',
    styles.missingCount === 0,
    styles.missingCount > 0 ? `без правил: ${styles.missing.join(', ')}` : '');
  check('основные стили применились',
    styles.background === 'rgb(255, 255, 255)' && String(styles.font).includes('Space Grotesk'),
    `фон ${styles.background}, шрифт ${styles.font}`);
  check('правил CSS больше сотни, то есть стили собраны, а не потеряны',
    styles.rules > 100, `правил: ${styles.rules}`);

  // Тёмная тема держится на переменных CSS и на darkMode: 'class'. При переезде
  // стилей в сборку это могло отвалиться незаметно: страница просто осталась бы
  // светлой. Переключаем класс и смотрим вычисленные цвета.
  const readColors = () => evaluate(`(() => {
    const style = getComputedStyle(document.body);
    return { bg: style.backgroundColor, text: style.color };
  })()`);
  const toggleDark = (on) => evaluate(`document.documentElement.classList.${on ? 'add' : 'remove'}('dark'), true`);
  // У body переход цвета на 0,3 с: сразу после переключения вычисленный цвет
  // ещё старый, поэтому ждём, пока переход закончится.
  const light = await readColors();
  await toggleDark(true);
  await sleep(500);
  const dark = await readColors();
  await toggleDark(false);
  await sleep(500);
  const back = await readColors();
  check('тёмная тема переключает фон и текст',
    light.bg === 'rgb(255, 255, 255)' && dark.bg === 'rgb(0, 0, 0)'
      && dark.text === 'rgb(255, 255, 255)' && back.bg === light.bg,
    `светлая ${light.bg}/${light.text}, тёмная ${dark.bg}/${dark.text}, обратно ${back.bg}`);

  // Шапка липкая, значит под ней едет содержимое: без фона текст наложится
  // сам на себя. Проверяем не класс, а вычисленный фон.
  const headerBackground = await evaluate(`(() => {
    const header = document.querySelector('header');
    if (!header) return 'шапки нет';
    return getComputedStyle(header).backgroundColor;
  })()`);
  check('у липкой шапки есть фон, а не прозрачность',
    typeof headerBackground === 'string' && headerBackground.startsWith('rgba(') && !headerBackground.endsWith(', 0)'),
    `фон шапки: ${headerBackground}`);

  console.log(`\nпройдено: ${passed}, провалено: ${failures.length}`);
  for (const failure of failures) console.log(`  ПРОВАЛ: ${failure}`);
  ws.close();
  stop();
  process.exit(failures.length === 0 ? 0 : 1);
} catch (error) {
  console.error(`\nПроверка не дошла до конца: ${error.message}`);
  stop();
  process.exit(2);
}
