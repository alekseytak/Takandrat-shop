/**
 * Отправка заказа мастеру через бота — со стороны магазина.
 *
 * Токен бота живёт только в переменных окружения (локально `.env`, на выкладке
 * — переменные Vercel) и никогда не попадает в браузер: страница спрашивает
 * свой же маршрут `/api/order-notify`, а с Telegram говорит сервер.
 *
 * Почему не через Supabase-функции: шлюз функций отвергает ключи витрины, и
 * заказ до них не доезжает. Здесь магазин ни от кого не зависит.
 *
 * Одна реализация на два входа: `api/order-notify.ts` для Vercel и маршрут в
 * `server.ts` для локального запуска.
 */

export type NotifyResult =
  | { ok: true }
  | { ok: false; reason: NotifyReason; detail?: string };

export type NotifyReason =
  | 'NO_BOT_TOKEN'
  | 'NO_ADMIN_CHAT'
  | 'EMPTY_ORDER'
  | 'ORDER_TOO_LONG'
  | 'TELEGRAM_REJECTED'
  | 'TELEGRAM_UNREACHABLE';

/** Длина сообщения в Telegram — 4096 знаков. Держим запас. */
const MAX_ORDER_LENGTH = 3500;

const config = () => ({
  token: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  chatId: (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim(),
});

export const notifyReady = (): { ready: boolean; reason?: NotifyReason } => {
  const { token, chatId } = config();
  if (!token) return { ready: false, reason: 'NO_BOT_TOKEN' };
  if (!chatId) return { ready: false, reason: 'NO_ADMIN_CHAT' };
  return { ready: true };
};

/**
 * Отправляет текст заказа в чат мастера.
 *
 * Возвращает причину отказа, а не бросает исключение: вызывающий решает, что
 * показать покупателю. Токен в ответе и в журнале не появляется никогда.
 */
export const sendOrderToMaster = async (text: string): Promise<NotifyResult> => {
  const { token, chatId } = config();
  if (!token) return { ok: false, reason: 'NO_BOT_TOKEN' };
  if (!chatId) return { ok: false, reason: 'NO_ADMIN_CHAT' };

  const order = String(text || '').trim();
  if (!order) return { ok: false, reason: 'EMPTY_ORDER' };
  if (order.length > MAX_ORDER_LENGTH) return { ok: false, reason: 'ORDER_TOO_LONG' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: order, disable_web_page_preview: true }),
    });
    const answer: any = await response.json().catch(() => null);
    if (!response.ok || !answer?.ok) {
      // Telegram объясняет отказ по-человечески: «chat not found», «Unauthorized».
      // Токена в этих словах нет, покупателю их не показываем — только в журнал.
      return { ok: false, reason: 'TELEGRAM_REJECTED', detail: String(answer?.description || response.status) };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, reason: 'TELEGRAM_UNREACHABLE', detail: String(error?.message || error) };
  }
};

/** Код ответа для маршрута: покупателю важно, ждать ему подтверждения или нет. */
export const statusFor = (reason?: NotifyReason): number => {
  if (!reason) return 200;
  if (reason === 'NO_BOT_TOKEN' || reason === 'NO_ADMIN_CHAT') return 503;
  if (reason === 'EMPTY_ORDER' || reason === 'ORDER_TOO_LONG') return 400;
  return 502;
};
