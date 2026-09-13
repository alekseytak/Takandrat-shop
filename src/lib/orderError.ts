import type { OrderReject } from '../../supabase/functions/admin-ai/order';

/**
 * Что покупатель читает, когда сервер отказал в заказе.
 *
 * Record<OrderReject, string> не даёт забыть причину: новая причина отказа на
 * сервере ломает сборку до тех пор, пока для неё не написано человеческое
 * объяснение. Причины приходят из order.ts — там же, где проверки.
 */
const MESSAGES: Record<OrderReject, string> = {
  EMPTY_ORDER: 'Корзина пуста — добавьте товар и попробуйте снова.',
  TOO_MANY_LINES: 'Слишком много позиций в одном заказе. Разделите его на два.',
  BAD_PRODUCT_ID: 'Не поняли, какой товар заказывают. Обновите страницу и соберите корзину заново.',
  BAD_QUANTITY: 'Количество в корзине неверное. Обновите страницу и попробуйте снова.',
  UNKNOWN_PRODUCT: 'Товар больше не продаётся. Обновите страницу и соберите корзину заново.',
  HIDDEN_PRODUCT: 'Этот товар снят с продажи. Напишите нам в Telegram, если он нужен.',
  NOT_ENOUGH_STOCK: 'Такого количества сейчас нет. Уменьшите количество или напишите нам в Telegram.',
  BAD_PRICE: 'Цена товара не настроена. Напишите нам в Telegram — поправим и примем заказ.',
};

const FALLBACK = 'Не удалось оформить заказ. Попробуйте ещё раз или напишите нам в Telegram.';

/** Достаёт причину отказа из ответа Edge Function и переводит её на русский. */
export const orderErrorMessage = (error: unknown): string => {
  const text = typeof error === 'string' ? error : String((error as any)?.message ?? '');
  const match = text.match(/"reason"\s*:\s*"([A-Z_]+)"/);
  const reason = match?.[1] as OrderReject | undefined;
  if (reason && reason in MESSAGES) return MESSAGES[reason];
  if (text.includes('TRINITY_TIMEOUT') || text.includes('COMM_LINK_FAILURE')) {
    return 'Связь с сервером пропала. Проверьте интернет и попробуйте снова.';
  }
  return FALLBACK;
};
