/**
 * Кто имеет право на админские действия.
 *
 * Было так: `fetch_orders` отдавал все заказы с именами, адресами и составом
 * любому, кто знает адрес функции и публичный anon-ключ. `fetch_stock` вместо
 * проверки принимал «секрет» из браузера, а секрет в браузере — не секрет.
 * Ни одно из этих действий не проверяло, кто его просит.
 *
 * Здесь решается, какие действия считать привилегированными и кого пускать.
 * Модуль чистый: ни Deno, ни Supabase, ни сети, поэтому правило проверяется
 * тестом, а в функции остаётся один вызов.
 */

export type AdminReject = 'ADMIN_UNVERIFIABLE' | 'NOT_ADMIN';

export type AdminDecision = { ok: true; userId: number } | { ok: false; reason: AdminReject };

/**
 * Разбирает список id владельцев: «123, 456 789».
 * Мусор отбрасывается молча, повторы схлопываются: опечатка в списке не должна
 * открывать доступ кому-то постороннему и не должна ломать доступ владельцу.
 */
export const parseAdminIds = (raw: unknown): number[] => {
  if (typeof raw !== 'string' && typeof raw !== 'number') return [];
  const parts = String(raw).split(/[\s,;]+/).filter((part) => part.length > 0);
  const ids: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) continue;
    const id = Number(part);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
};

/**
 * Список владельцев из окружения функции.
 *
 * Если ADMIN_TELEGRAM_IDS не задан, берётся TELEGRAM_ADMIN_CHAT_ID — но только
 * если он положительный. У личного чата id чата совпадает с id человека, а у
 * группы он отрицательный, и тогда брать его нельзя: это id группы, а не
 * человека, и пускать по нему некого.
 */
export const adminIdsFromEnv = (list: unknown, adminChatId: unknown): number[] => {
  const explicit = parseAdminIds(list);
  if (explicit.length > 0) return explicit;
  const fallback = parseAdminIds(adminChatId).filter((id) => id > 0);
  return fallback;
};

/**
 * Требует ли действие проверки владельца.
 * @param action - имя действия из запроса.
 * @param payload - тело запроса.
 */
export const isPrivilegedAction = (action: unknown, payload: unknown): boolean => {
  if (action === 'fetch_orders') return true;
  if (action === 'fetch_stock') return true;
  // Скрытые товары видит только владелец. Сравнение строгое: строка "true"
  // из запроса — это не «да», иначе фильтр скрытых товаров обходится.
  if (action === 'search') return (payload as { include_hidden?: unknown } | null)?.include_hidden === true;
  return false;
};

/**
 * Пускать ли этого человека к привилегированному действию.
 * @param userId - id покупателя, взятый из проверенной подписи Telegram.
 * @param ids - список id владельцев.
 */
export const authorizeAdmin = (userId: number, ids: number[]): AdminDecision => {
  if (ids.length === 0) return { ok: false, reason: 'ADMIN_UNVERIFIABLE' };
  if (!ids.includes(userId)) return { ok: false, reason: 'NOT_ADMIN' };
  return { ok: true, userId };
};
