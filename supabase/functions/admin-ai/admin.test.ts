/**
 * Права владельца. Запуск: node supabase/functions/admin-ai/admin.test.ts
 */
import { adminIdsFromEnv, authorizeAdmin, isPrivilegedAction, parseAdminIds } from './admin.ts';

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

console.log('права владельца\n');

check('список через запятую', JSON.stringify(parseAdminIds('111,222')) === '[111,222]');
check('список через пробел', JSON.stringify(parseAdminIds('111 222')) === '[111,222]');
check('список вперемешку', JSON.stringify(parseAdminIds(' 111 , 222;333 ')) === '[111,222,333]');
check('число принимается', JSON.stringify(parseAdminIds(444)) === '[444]');
check('пустая строка — пустой список', parseAdminIds('').length === 0);
check('undefined — пустой список', parseAdminIds(undefined).length === 0);
check('мусор отбрасывается', JSON.stringify(parseAdminIds('111, абв, 222, -, 0')) === '[111,222]');
check('отрицательные отбрасываются', parseAdminIds('-100123').length === 0);
check('ноль отбрасывается', parseAdminIds('0').length === 0);
check('дробное отбрасывается', parseAdminIds('12.5').length === 0);
check('повторы схлопываются', JSON.stringify(parseAdminIds('111,111,222')) === '[111,222]');
check('очень большое число отбрасывается', parseAdminIds('99999999999999999999').length === 0);

check('личный чат годится как id владельца', JSON.stringify(adminIdsFromEnv('', '12345')) === '[12345]');
check('групповой чат не годится', adminIdsFromEnv('', '-1001234567890').length === 0);
check('явный список важнее чата', JSON.stringify(adminIdsFromEnv('777', '12345')) === '[777]');
check('ни списка, ни чата — пусто', adminIdsFromEnv(undefined, undefined).length === 0);

check('привилегированно: все заказы', isPrivilegedAction('fetch_orders', {}) === true);
check('привилегированно: склад', isPrivilegedAction('fetch_stock', {}) === true);
check('привилегированно: поиск со скрытыми', isPrivilegedAction('search', { include_hidden: true }) === true);
check('обычный поиск — не привилегированно', isPrivilegedAction('search', {}) === false);
check('строка "true" не считается согласием', isPrivilegedAction('search', { include_hidden: 'true' }) === false);
check('создание заказа — не привилегированно', isPrivilegedAction('create_order', {}) === false);
check('чат — не привилегированно', isPrivilegedAction('chat', {}) === false);
check('неизвестное действие — не привилегированно', isPrivilegedAction('что-то', {}) === false);
check('пустое действие — не привилегированно', isPrivilegedAction(undefined, undefined) === false);

check('пустой список владельцев — отказ, а не пропуск', (() => {
  const decision = authorizeAdmin(111, []);
  return !decision.ok && decision.reason === 'ADMIN_UNVERIFIABLE';
})());
check('владелец проходит', (() => {
  const decision = authorizeAdmin(111, [111, 222]);
  return decision.ok && decision.userId === 111;
})());
check('посторонний не проходит', (() => {
  const decision = authorizeAdmin(999, [111, 222]);
  return !decision.ok && decision.reason === 'NOT_ADMIN';
})());
check('похожий id не проходит', (() => {
  const decision = authorizeAdmin(1112, [111, 222]);
  return !decision.ok && decision.reason === 'NOT_ADMIN';
})());
check('без списка не проходит даже ноль', (() => {
  const decision = authorizeAdmin(0, []);
  return !decision.ok && decision.reason === 'ADMIN_UNVERIFIABLE';
})());

console.log(`\nпройдено: ${passed}, провалено: ${failed}`);
if (failed > 0) process.exit(1);
