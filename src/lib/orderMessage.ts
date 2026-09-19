import { BRAND_NAME } from '@/constants';

/**
 * Заказ уходит мастеру сообщением в Telegram.
 *
 * Так магазин работает без сервера: витрина собирает заказ и открывает чат с
 * ботом, где текст уже набран — покупателю остаётся нажать «отправить». Мастер
 * получает состав, размер, адрес ПВЗ и того, кто заказал.
 *
 * Почему не записью в базу: пока шлюз функций отвергает ключи витрины, заказ до
 * базы не доезжает и покупатель упирается в ошибку. Сообщение в чат не зависит
 * ни от шлюза, ни от базы — сломаться нечему. Путь через базу остался в
 * `adminService` и включается переменной `VITE_ORDER_MODE=database`.
 */
export const ORDER_BOT = 'takandrat_bot';

export type OrderLine = {
  name: string;
  quantity: number;
  price: number;
  size?: string;
};

export type OrderDraft = {
  lines: OrderLine[];
  total: number;
  address: string;
  customerName?: string;
};

/** Кто заказывает: берём из подписи Telegram, которую передаёт мини-приложение. */
const telegramBuyer = (): string => {
  const user = (globalThis as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) return 'не из Telegram';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const username = user.username ? ` @${user.username}` : '';
  return `${name || 'без имени'}${username} (id ${user.id})`;
};

/** Текст заказа: то, что мастер прочитает в чате. Только факты заказа. */
export const buildOrderMessage = ({ lines, total, address, customerName }: OrderDraft): string => {
  const items = lines
    .map((line, index) => {
      const size = line.size ? ` / ${line.size}` : '';
      return `${index + 1}. ${line.name}${size} — ${line.quantity} × ${line.price}₽`;
    })
    .join('\n');

  return [
    `ЗАКАЗ · ${BRAND_NAME}`,
    '',
    items,
    '',
    `Итого: ${total}₽`,
    `ПВЗ: ${address || 'адрес не указан'}`,
    `Покупатель: ${customerName || telegramBuyer()}`,
    '',
    'Оплату перевожу на карту или в крипте, подтверждение пришлю сюда же.',
  ].join('\n');
};

/** Ссылка на чат с ботом, где текст заказа уже набран. */
export const orderChatLink = (message: string): string =>
  `https://t.me/${ORDER_BOT}?text=${encodeURIComponent(message)}`;

/**
 * Открывает чат с ботом — только внутри Telegram, средствами самого Telegram:
 * чат встаёт поверх мини-приложения, магазин остаётся на месте.
 *
 * В обычном браузере НЕ открываем ничего сами: попытка увести страницу на t.me
 * уносит покупателя из магазина, и он теряет и витрину, и корзину. Там экран
 * показывает ссылку, по которой покупатель идёт сам, когда захочет.
 */
export const openOrderChat = (message: string): 'telegram' | 'browser' => {
  const webApp = (globalThis as any)?.Telegram?.WebApp;
  // Настоящий Telegram узнаём по живой подписи initData. Одного наличия
  // openTelegramLink мало: в браузере живёт заглушка, которая уводит страницу
  // на t.me — покупатель терял магазин и корзину.
  const inTelegram = Boolean(webApp && String(webApp.initData || '').length > 0);
  if (inTelegram && typeof webApp.openTelegramLink === 'function') {
    webApp.openTelegramLink(orderChatLink(message));
    return 'telegram';
  }
  return 'browser';
};

/**
 * Пробует отправить заказ мастеру через свой сервер.
 *
 * Токен бота живёт в переменных окружения и в браузер не попадает: страница
 * говорит со своим маршрутом `/api/order-notify`. Возвращает `false`, если
 * маршрут не настроен или Telegram отказал — тогда заказ уходит обычным путём:
 * покупатель открывает чат с ботом, где текст уже набран.
 */
export const sendOrderToServer = async (message: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/order-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    const answer: any = await response.json().catch(() => null);
    if (!response.ok || !answer?.ok) {
      console.warn('[ORDER_NOTIFY] сервер не отправил заказ:', answer?.reason || response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[ORDER_NOTIFY] сервер недоступен:', error);
    return false;
  }
};
