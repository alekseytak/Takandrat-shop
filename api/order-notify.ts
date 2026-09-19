import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendOrderToMaster, statusFor } from '../src/lib/orderNotify';

/**
 * Заказ уходит мастеру в Telegram — на выкладке Vercel.
 *
 * Токен бота лежит в переменных Vercel (TELEGRAM_BOT_TOKEN,
 * TELEGRAM_ADMIN_CHAT_ID) и в браузер не попадает: страница зовёт этот маршрут,
 * а с Telegram говорит сервер.
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, reason: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body || {};
  const result = await sendOrderToMaster(String(body.text || ''));

  if (result.ok) {
    response.status(200).json({ ok: true });
    return;
  }
  // Причина отказа — без токена и без чужих данных: «нет ключа», «Telegram
  // отказал», «не дозвонились».
  console.warn('[ORDER_NOTIFY]', result.reason, result.detail || '');
  response.status(statusFor(result.reason)).json({ ok: false, reason: result.reason });
}
