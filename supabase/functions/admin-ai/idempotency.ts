/**
 * Повторная отправка заказа.
 *
 * Беда была такая: кнопка блокируется, пока идёт запрос, но если ответ
 * потеряется в сети, покупатель нажмёт ещё раз и в базе окажутся два заказа.
 * Лечится ключом: покупатель присылает один и тот же ключ при повторе, а
 * сервер, увидев знакомый ключ, возвращает прежний заказ вместо нового.
 *
 * Модуль чистый — ни Deno, ни Supabase, ни сети, поэтому решение проверяется
 * тестом, а в самой функции остаётся один запрос к базе.
 */

export interface ExistingOrder {
  id: string;
  total_price?: number | null;
}

export type IdempotencyDecision =
  | { kind: 'create' }
  | { kind: 'repeat'; orderId: string; total?: number };

/** Ключ принимается только осмысленного вида: строчный, от 8 до 100 знаков. */
export const idempotencyKey = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (key.length < 8 || key.length > 100) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) return null;
  return key;
};

/**
 * Что делать, увидев ключ: создать заказ или вернуть прежний.
 * @param existing - строки, найденные по этому ключу (обычно ноль или одна).
 * @param key - ключ идемпотентности из запроса, если он есть.
 */
export const decideByKey = (existing: ExistingOrder[] | null | undefined, key: string | null): IdempotencyDecision => {
  if (key === null) return { kind: 'create' };
  const found = (existing ?? []).find((order) => typeof order?.id === 'string' && order.id.length > 0);
  if (!found) return { kind: 'create' };
  return {
    kind: 'repeat',
    orderId: found.id,
    ...(typeof found.total_price === 'number' ? { total: found.total_price } : {}),
  };
};
