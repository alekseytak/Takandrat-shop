/**
 * Сборка заказа из того, что прислал браузер.
 *
 * Модуль намеренно ничего не знает ни о Deno, ни о Supabase: на вход идут
 * строки корзины и строки каталога, на выходе — либо готовые строки заказа с
 * ценой из базы, либо причина отказа. Так проверку можно прогнать тестом
 * (order.test.ts), не поднимая Edge Function.
 *
 * Главное правило: цене, количеству и наличию из браузера не верим. Всё, что
 * влияет на деньги, берётся из каталога.
 */

/** Строка каталога — единственный источник правды о цене и наличии. */
export type CatalogRow = {
  id: string | number;
  name?: string | null;
  price: number | string | null;
  is_visible?: boolean | null;
  stock_quantity?: number | null;
};

/** Что приходит от браузера. Цены здесь нет и быть не должно. */
export type RawLine = {
  product_id?: unknown;
  quantity?: unknown;
  size?: unknown;
};

/** Готовая строка заказа: цена посчитана по каталогу. */
export type OrderLine = {
  product_id: string;
  name: string;
  size: string;
  quantity: number;
  price_cents: number;
  sum_cents: number;
};

export type OrderReject =
  | 'EMPTY_ORDER'
  | 'TOO_MANY_LINES'
  | 'BAD_PRODUCT_ID'
  | 'BAD_QUANTITY'
  | 'UNKNOWN_PRODUCT'
  | 'HIDDEN_PRODUCT'
  | 'NOT_ENOUGH_STOCK'
  | 'BAD_PRICE';

export type OrderBuild =
  | { ok: true; lines: OrderLine[]; totalCents: number }
  | { ok: false; reason: OrderReject; detail?: string };

/** Больше позиций в одном заказе не бывает: дальше это уже не розница. */
export const MAX_LINES = 20;
/** Потолок на одну позицию: защита от заказа «1000 ремней» одним запросом. */
export const MAX_QUANTITY_PER_LINE = 20;
const MAX_SIZE_LENGTH = 40;

const intOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  return value;
};

const textOrEmpty = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, MAX_SIZE_LENGTH) : '';

export function buildOrder(rawItems: unknown, catalogRows: CatalogRow[]): OrderBuild {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, reason: 'EMPTY_ORDER' };
  }
  if (rawItems.length > MAX_LINES) {
    return { ok: false, reason: 'TOO_MANY_LINES' };
  }

  // Сначала приводим вход к проверенным строкам: одна позиция = товар + размер.
  const merged = new Map<string, { productId: string; size: string; quantity: number }>();
  for (const raw of rawItems as RawLine[]) {
    const productIdRaw = raw?.product_id;
    const productId = typeof productIdRaw === 'number'
      ? String(productIdRaw)
      : typeof productIdRaw === 'string' ? productIdRaw.trim() : '';
    if (!productId) {
      return { ok: false, reason: 'BAD_PRODUCT_ID' };
    }

    const quantity = intOrNull(raw?.quantity);
    if (quantity === null || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
      return { ok: false, reason: 'BAD_QUANTITY', detail: String(raw?.quantity) };
    }

    const size = textOrEmpty(raw?.size);
    const key = `${productId}\u0000${size}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > MAX_QUANTITY_PER_LINE) {
        return { ok: false, reason: 'BAD_QUANTITY', detail: String(existing.quantity) };
      }
    } else {
      merged.set(key, { productId, size, quantity });
    }
  }

  // Наличие проверяем по товару целиком: два размера одного ремня — это две
  // штуки со склада, а не одна.
  const perProduct = new Map<string, number>();
  const byId = new Map<string, CatalogRow>();
  for (const row of catalogRows ?? []) {
    byId.set(String(row?.id), row);
  }

  for (const line of merged.values()) {
    perProduct.set(line.productId, (perProduct.get(line.productId) ?? 0) + line.quantity);
  }
  for (const [productId, quantity] of perProduct) {
    const row = byId.get(productId);
    if (!row) {
      return { ok: false, reason: 'UNKNOWN_PRODUCT', detail: productId };
    }
    if (row.is_visible === false) {
      return { ok: false, reason: 'HIDDEN_PRODUCT', detail: productId };
    }
    const stock = row.stock_quantity;
    if (typeof stock === 'number' && Number.isFinite(stock) && quantity > stock) {
      return { ok: false, reason: 'NOT_ENOUGH_STOCK', detail: `${productId}: ${quantity} > ${stock}` };
    }
  }

  const lines: OrderLine[] = [];
  let totalCents = 0;
  for (const line of merged.values()) {
    const row = byId.get(line.productId)!;
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, reason: 'BAD_PRICE', detail: line.productId };
    }
    const priceCents = Math.round(price * 100);
    const sumCents = priceCents * line.quantity;
    totalCents += sumCents;
    lines.push({
      product_id: line.productId,
      name: typeof row.name === 'string' ? row.name : '',
      size: line.size,
      quantity: line.quantity,
      price_cents: priceCents,
      sum_cents: sumCents,
    });
  }

  return { ok: true, lines, totalCents };
}
