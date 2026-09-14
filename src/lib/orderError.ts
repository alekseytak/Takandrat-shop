import type { OrderReject } from '../../supabase/functions/admin-ai/order';
import type { InitDataReject } from '../../supabase/functions/admin-ai/telegram';

/** Обе семьи отказов: по заказу и по подписи Telegram. */
type RejectReason = OrderReject | InitDataReject;

/**
 * Что покупатель читает, когда сервер отказал в заказе.
 *
 * Record<OrderReject, string> не даёт забыть причину: новая причина отказа на
 * сервере ломает сборку до тех пор, пока для неё не написано человеческое
 * объяснение. Причины приходят из order.ts — там же, где проверки.
 */
const MESSAGES: Record<RejectReason, string> = {
  EMPTY_ORDER: 'Корзина пуста — добавьте товар и попробуйте снова.',
  TOO_MANY_LINES: 'Слишком много позиций в одном заказе. Разделите его на два.',
  BAD_PRODUCT_ID: 'Не поняли, какой товар заказывают. Обновите страницу и соберите корзину заново.',
  BAD_QUANTITY: 'Количество в корзине неверное. Обновите страницу и попробуйте снова.',
  UNKNOWN_PRODUCT: 'Товар больше не продаётся. Обновите страницу и соберите корзину заново.',
  HIDDEN_PRODUCT: 'Этот товар снят с продажи. Напишите нам в Telegram, если он нужен.',
  NOT_ENOUGH_STOCK: 'Такого количества сейчас нет. Уменьшите количество или напишите нам в Telegram.',
  BAD_PRICE: 'Цена товара не настроена. Напишите нам в Telegram — поправим и примем заказ.',
  INIT_DATA_MISSING: 'Заказ оформляют из Telegram — так мы знаем, кому его отдать. Откройте магазин через бота @takandrat_bot и оформите заказ там.',
  INIT_DATA_MALFORMED: 'Не удалось убедиться, что заказ из Telegram. Откройте магазин заново через бота @takandrat_bot.',
  INIT_DATA_BAD_HASH: 'Не удалось убедиться, что заказ из Telegram. Откройте магазин заново через бота @takandrat_bot.',
  INIT_DATA_EXPIRED: 'Сессия Telegram устарела. Откройте магазин заново через бота @takandrat_bot и оформите заказ.',
  INIT_DATA_NO_USER: 'Telegram не передал, кто оформляет заказ. Откройте магазин заново через бота @takandrat_bot.',
};

const FALLBACK = 'Не удалось оформить заказ. Попробуйте ещё раз или напишите нам в Telegram.';

/** Достаёт причину отказа из ответа Edge Function и переводит её на русский. */
export const orderErrorMessage = (error: unknown): string => {
  const text = typeof error === 'string' ? error : String((error as any)?.message ?? '');
  const match = text.match(/"reason"\s*:\s*"([A-Z_]+)"/);
  const reason = match?.[1] as RejectReason | undefined;
  if (reason && reason in MESSAGES) return MESSAGES[reason];
  if (text.includes('TRINITY_TIMEOUT') || text.includes('COMM_LINK_FAILURE')) {
    return 'Связь с сервером пропала. Проверьте интернет и попробуйте снова.';
  }
  return FALLBACK;
};
