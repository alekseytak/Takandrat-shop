/**
 * Повторная отправка заказа. Запуск: node supabase/functions/admin-ai/idempotency.test.ts
 */
import { decideByKey, idempotencyKey } from './idempotency.ts';

let passed = 0;
let failed = 0;
const check = (title: string, ok: boolean): void => {
  if (ok) {
    passed += 1;
    console.log(`  ок   ${title}`);
  } else {
    failed += 1;
    console.log(`  ПРОВАЛ ${title}`);
  }
};

const UUID = '9f1c2b3a-4d5e-6f70-8a9b-0c1d2e3f4a5b';

console.log('ключ идемпотентности\n');

check('нормальный ключ принимается', idempotencyKey(UUID) === UUID);
check('ключ обрезается от пробелов', idempotencyKey(`  ${UUID}  `) === UUID);
check('короткий ключ не принимается', idempotencyKey('корот') === null);
check('пустая строка не принимается', idempotencyKey('') === null);
check('не строка не принимается', idempotencyKey(42) === null);
check('undefined не принимается', idempotencyKey(undefined) === null);
check('слишком длинный ключ не принимается', idempotencyKey('a'.repeat(101)) === null);
check('ключ с пробелом внутри не принимается', idempotencyKey('ключ с пробелом') === null);
check('двоеточие и точка допустимы', idempotencyKey('shop:order.2026-09-14') === 'shop:order.2026-09-14');

check('без ключа заказ создаётся', decideByKey(null, null).kind === 'create');
check('незнакомый ключ — заказ создаётся', decideByKey([], UUID).kind === 'create');
check('знакомый ключ — возвращается прежний заказ', (() => {
  const decision = decideByKey([{ id: 'order-1', total_price: 3200 }], UUID);
  return decision.kind === 'repeat' && decision.orderId === 'order-1' && decision.total === 3200;
})());
check('две строки по ключу — берётся первая', (() => {
  const decision = decideByKey([{ id: 'order-1' }, { id: 'order-2' }], UUID);
  return decision.kind === 'repeat' && decision.orderId === 'order-1';
})());
check('строка без id не считается совпадением', decideByKey([{ id: '' }], UUID).kind === 'create');
check('сумма не числом не выдумывается', (() => {
  const decision = decideByKey([{ id: 'order-1', total_price: null }], UUID);
  return decision.kind === 'repeat' && decision.total === undefined;
})());
check('ключ без заказов и без ключа ведут себя по-разному', decideByKey(null, null).kind === 'create' && decideByKey(null, UUID).kind === 'create');

console.log(`\nпройдено: ${passed}, провалено: ${failed}`);
if (failed > 0) process.exit(1);
