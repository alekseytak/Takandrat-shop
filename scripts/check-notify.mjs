#!/usr/bin/env node
/**
 * Проверка отправки заказа мастеру: маршрут магазина.
 *
 * Две пробы, и обе могут упасть:
 *   1. Без токена бота маршрут отказывает с понятной причиной, а не делает вид,
 *      что заказ ушёл.
 *   2. С неверным токеном маршрут ДОЗВАНИВАЕТСЯ до Telegram и передаёт его
 *      отказ. Так проверяется, что это настоящий вызов бота, а не заглушка,
 *      которая всегда отвечает «получилось».
 *
 *   node scripts/check-notify.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.NOTIFY_PORT || 3123);
const BASE = `http://127.0.0.1:${PORT}`;

let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log('  ✓', name); return; }
  failed += 1;
  console.error('  ✗', name, detail ? `— ${detail}` : '');
};

async function withServer(env, run) {
  const child = spawn('node', ['server.ts'], {
    env: { ...process.env, PORT: String(PORT), ...env },
    stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 40; i += 1) {
      try {
        const ping = await fetch(`${BASE}/api/payment-details`);
        if (ping.ok) break;
      } catch { /* сервер ещё поднимается */ }
      await sleep(250);
    }
    return await run();
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
  }
}

const post = (text) => fetch(`${BASE}/api/order-notify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});

// 1. Токена нет: заказ не «уходит», покупателю честно отказывают.
await withServer({ TELEGRAM_BOT_TOKEN: '', TELEGRAM_ADMIN_CHAT_ID: '' }, async () => {
  const answer = await post('ЗАКАЗ · проверка');
  const body = await answer.json().catch(() => ({}));
  check('без токена маршрут отказывает', answer.status === 503, `код ${answer.status}`);
  check('причина отказа названа', body.reason === 'NO_BOT_TOKEN', `reason: ${body.reason || 'нет'}`);
  check('в ответе нет токена', !JSON.stringify(body).includes('bot'), JSON.stringify(body).slice(0, 80));
});

// 2. Токен неверный: маршрут обязан дойти до Telegram и передать его отказ.
await withServer({ TELEGRAM_BOT_TOKEN: '123456:тест-неверный-токен', TELEGRAM_ADMIN_CHAT_ID: '1' }, async () => {
  const answer = await post('ЗАКАЗ · проверка');
  const body = await answer.json().catch(() => ({}));
  check('с неверным токеном Telegram отвечает отказом', answer.status === 502, `код ${answer.status}`);
  check('отказ пришёл от Telegram, а не выдуман',
    body.reason === 'TELEGRAM_REJECTED', `reason: ${body.reason || 'нет'}`);
});

// 3. Пустой заказ не отправляется вовсе.
await withServer({ TELEGRAM_BOT_TOKEN: '123456:тест-неверный-токен', TELEGRAM_ADMIN_CHAT_ID: '1' }, async () => {
  const answer = await post('   ');
  const body = await answer.json().catch(() => ({}));
  check('пустой заказ не уходит', answer.status === 400 && body.reason === 'EMPTY_ORDER',
    `код ${answer.status}, reason ${body.reason || 'нет'}`);
});

// 4. Обработчик Vercel: тот же отказ без токена. Импорт ловит поломку вида
//    «относительный импорт без расширения» — на боевом рантайме Vercel функция
//    из-за неё не загружалась вовсе (FUNCTION_INVOCATION_FAILED), а локальный
//    Express при этом работал и ничего не подозревал.
try {
  const { default: vercelHandler } = await import('../api/order-notify.ts');
  const answer = await new Promise((resolve) => {
    const response = {
      code: 0,
      setHeader() {},
      status(code) { this.code = code; return this; },
      json(body) { resolve({ code: this.code, body }); },
    };
    vercelHandler({ method: 'POST', body: { text: 'ЗАКАЗ · проверка' } }, response);
  });
  check('обработчик Vercel загружается и отказывает без токена',
    answer.code === 503 && answer.body?.reason === 'NO_BOT_TOKEN',
    `код ${answer.code}, reason ${answer.body?.reason || 'нет'}`);
} catch (error) {
  check('обработчик Vercel загружается и отказывает без токена', false,
    String(error?.message || error));
}

console.log(failed ? `\nПровалов: ${failed}` : '\nОтправка заказа мастеру: маршрут ведёт себя верно.');
process.exit(failed ? 1 : 0);
