import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Заказ уходит мастеру в Telegram — на выкладке Vercel.
 *
 * Файл нарочно самостоятельный, без импортов из `src/`: на боевом рантайме
 * Vercel относительный импорт без расширения (`../src/lib/orderNotify`) не
 * разрешается, и функция падала при загрузке — FUNCTION_INVOCATION_FAILED.
 * Логика та же, что в `src/lib/orderNotify.ts` (её использует локальный
 * `server.ts`); проверка `check:notify` держит обе стороны в одном поведении.
 *
 * Токен бота и id чата — только в переменных окружения Vercel
 * (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`). В браузер они не попадают:
 * страница зовёт этот маршрут, а с Telegram говорит сервер.
 */

/** Длина сообщения в Telegram — 4096 знаков. Держим запас. */
const MAX_ORDER_LENGTH = 3500;

/** Токен бота выглядит как «123456789:AA…». Проверяем вид до звонка в Telegram:
 *  иначе неверно вставленный ключ превращается в невнятное «Not Found». */
const looksLikeBotToken = (token: string): boolean => /^\d{6,}:[A-Za-z0-9_-]{25,}$/.test(token);

type NotifyReason =
  | 'NO_BOT_TOKEN'
  | 'BOT_TOKEN_MALFORMED'
  | 'NO_ADMIN_CHAT'
  | 'EMPTY_ORDER'
  | 'ORDER_TOO_LONG'
  | 'TELEGRAM_REJECTED'
  | 'TELEGRAM_UNREACHABLE';

/** Код ответа: покупателю важно, ждать ему подтверждения или нет. */
const statusFor = (reason: NotifyReason): number => {
  if (reason === 'NO_BOT_TOKEN' || reason === 'NO_ADMIN_CHAT' || reason === 'BOT_TOKEN_MALFORMED') return 503;
  if (reason === 'EMPTY_ORDER' || reason === 'ORDER_TOO_LONG') return 400;
  return 502;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, reason: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
  const body = typeof request.body === 'string'
    ? (() => { try { return JSON.parse(request.body || '{}'); } catch { return {}; } })()
    : request.body || {};
  const order = String(body.text || '').trim();

  // Причина отказа возвращается словами, токен — никогда.
  const refuse = (reason: NotifyReason, detail = '') => {
    console.warn('[ORDER_NOTIFY]', reason, detail);
    // Отказ Telegram отдаём словами: «chat not found», «bot can't initiate
    // conversation» — это подсказка владельцу, что чинить, и токена в этих
    // словах нет.
    response.status(statusFor(reason)).json({ ok: false, reason, detail: detail || undefined });
  };

  if (!token) return refuse('NO_BOT_TOKEN');
  if (!looksLikeBotToken(token)) return refuse('BOT_TOKEN_MALFORMED');
  if (!chatId) return refuse('NO_ADMIN_CHAT');
  if (!order) return refuse('EMPTY_ORDER');
  if (order.length > MAX_ORDER_LENGTH) return refuse('ORDER_TOO_LONG');

  try {
    const answer = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: order, disable_web_page_preview: true }),
    });
    const payload: any = await answer.json().catch(() => null);
    if (!answer.ok || !payload?.ok) {
      // Telegram объясняет отказ по-человечески: «chat not found», «Unauthorized».
      return refuse('TELEGRAM_REJECTED', String(payload?.description || answer.status));
    }
    response.status(200).json({ ok: true });
  } catch (error: any) {
    return refuse('TELEGRAM_UNREACHABLE', String(error?.message || error));
  }
}
