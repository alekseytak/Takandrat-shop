/**
 * Проверка сборки заказа. Запуск: node supabase/functions/admin-ai/order.test.ts
 *
 * Тест зовёт buildOrder так же, как это делает Edge Function: строки корзины
 * из браузера плюс строки каталога из базы. Каталог здесь — то, что верлила бы
 * база, поэтому проверяется именно то, что увидит покупатель.
 */
import { buildOrder, MAX_LINES, MAX_QUANTITY_PER_LINE } from './order.ts';

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = '') => {
  if (condition) {
    passed += 1;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const catalog = [
  { id: 7, name: 'Ремень S-07', price: 3200, is_visible: true, stock_quantity: 3 },
  { id: 11, name: 'Лонгслив ASH GREY', price: 3500, is_visible: true, stock_quantity: 5 },
  { id: 12, name: 'Снятый с продажи', price: 1000, is_visible: false, stock_quantity: 5 },
  { id: 13, name: 'Последняя штука', price: 900, is_visible: true, stock_quantity: 1 },
  { id: 14, name: 'Без цены', price: 0, is_visible: true, stock_quantity: 5 },
];

// 1. Обычный заказ: цена и сумма считаются по каталогу.
const honest = buildOrder([{ product_id: '7', quantity: 2, size: 'L' }], catalog);
check('честный заказ принят', honest.ok === true, JSON.stringify(honest));
if (honest.ok) {
  check('сумма по каталогу: 3200 × 2', honest.totalCents === 640000, String(honest.totalCents));
  check('размер сохранён', honest.lines[0].size === 'L', honest.lines[0].size);
  check('название из каталога', honest.lines[0].name === 'Ремень S-07', honest.lines[0].name);
  check('цена в строке из каталога', honest.lines[0].price_cents === 320000, String(honest.lines[0].price_cents));
}

// 2. Подмена цены из браузера ничего не меняет.
const tampered = buildOrder(
  [{ product_id: '7', quantity: 2, size: 'L', price_cents: 1, price: 0.01 } as any],
  catalog,
);
check('подменённая цена проигнорирована', tampered.ok === true && tampered.totalCents === 640000,
  tampered.ok ? String(tampered.totalCents) : tampered.reason);

// 3. Количество проверяется.
for (const bad of [0, -1, 1.5, MAX_QUANTITY_PER_LINE + 1, '2', null, undefined, NaN]) {
  const result = buildOrder([{ product_id: '7', quantity: bad, size: 'L' }], catalog);
  check(`количество ${String(bad)} отклонено`,
    result.ok === false && result.reason === 'BAD_QUANTITY',
    result.ok ? 'принято' : result.reason);
}

// 4. Товар должен существовать и продаваться.
const unknown = buildOrder([{ product_id: 'нет-такого', quantity: 1, size: '' }], catalog);
check('неизвестный товар отклонён', unknown.ok === false && unknown.reason === 'UNKNOWN_PRODUCT',
  unknown.ok ? 'принято' : unknown.reason);

const hidden = buildOrder([{ product_id: '12', quantity: 1, size: '' }], catalog);
check('скрытый товар отклонён', hidden.ok === false && hidden.reason === 'HIDDEN_PRODUCT',
  hidden.ok ? 'принято' : hidden.reason);

const noPrice = buildOrder([{ product_id: '14', quantity: 1, size: '' }], catalog);
check('товар без цены отклонён', noPrice.ok === false && noPrice.reason === 'BAD_PRICE',
  noPrice.ok ? 'принято' : noPrice.reason);

// 5. Наличие: со склада уходит ровно столько, сколько есть.
const overStock = buildOrder([{ product_id: '13', quantity: 2, size: '' }], catalog);
check('больше остатка отклонено', overStock.ok === false && overStock.reason === 'NOT_ENOUGH_STOCK',
  overStock.ok ? 'принято' : overStock.reason);

const splitSizes = buildOrder(
  [{ product_id: '13', quantity: 1, size: 'M' }, { product_id: '13', quantity: 1, size: 'L' }],
  catalog,
);
check('два размера одного товара считаются вместе по остатку',
  splitSizes.ok === false && splitSizes.reason === 'NOT_ENOUGH_STOCK',
  splitSizes.ok ? 'принято' : splitSizes.reason);

// 6. Разные размеры — разные строки, одинаковые сливаются.
const twoSizes = buildOrder(
  [{ product_id: '11', quantity: 1, size: 'M' }, { product_id: '11', quantity: 1, size: 'L' }],
  catalog,
);
check('размеры не слиты в одну строку', twoSizes.ok === true && twoSizes.lines.length === 2,
  twoSizes.ok ? String(twoSizes.lines.length) : twoSizes.reason);

const sameTwice = buildOrder(
  [{ product_id: '11', quantity: 1, size: 'M' }, { product_id: '11', quantity: 2, size: 'M' }],
  catalog,
);
check('одинаковые строки слиты', sameTwice.ok === true && sameTwice.lines.length === 1
  && sameTwice.lines[0].quantity === 3 && sameTwice.totalCents === 1050000,
  sameTwice.ok ? JSON.stringify(sameTwice.lines) : sameTwice.reason);

// 7. Пустая корзина и слишком длинный заказ.
check('пустая корзина отклонена',
  buildOrder([], catalog).ok === false && (buildOrder([], catalog) as any).reason === 'EMPTY_ORDER');
check('не массив отклонён', buildOrder('7', catalog).ok === false);
check('слишком много позиций отклонено',
  (() => {
    const many = Array.from({ length: MAX_LINES + 1 }, () => ({ product_id: '11', quantity: 1, size: 'M' }));
    const result = buildOrder(many, catalog);
    return result.ok === false && result.reason === 'TOO_MANY_LINES';
  })());

// 8. Пустой каталог: заказ невозможен, потому что цену проверить нечем.
const emptyCatalog = buildOrder([{ product_id: '7', quantity: 1, size: 'L' }], []);
check('пустой каталог — заказ отклонён',
  emptyCatalog.ok === false && emptyCatalog.reason === 'UNKNOWN_PRODUCT',
  emptyCatalog.ok ? 'принято' : emptyCatalog.reason);

// 9. Товар без остатка в базе (null) продаётся: наличие не отслеживается.
const noStockField = buildOrder(
  [{ product_id: '99', quantity: 5, size: '' }],
  [{ id: 99, name: 'Под заказ', price: 1500, is_visible: true, stock_quantity: null }],
);
check('товар без учёта остатка продаётся', noStockField.ok === true && noStockField.totalCents === 750000,
  noStockField.ok ? String(noStockField.totalCents) : noStockField.reason);

console.log(`пройдено: ${passed}, провалено: ${failures.length}`);
for (const failure of failures) console.log(`  ПРОВАЛ: ${failure}`);
if (failures.length > 0) process.exit(1);
