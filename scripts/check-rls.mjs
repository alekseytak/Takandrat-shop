/**
 * Проверка границы доступа к базе.
 *
 * Магазин ходит в Supabase с anon-ключом, а этот ключ публичный: он лежит в
 * бандле и виден любому. Значит единственная защита — правила RLS в самой базе.
 * Этот скрипт стучится в базу тем же публичным ключом, что и браузер, и
 * смотрит, что ей отвечают.
 *
 * Запуск:
 *   node scripts/check-rls.mjs
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/check-rls.mjs
 *
 * Ничего не меняет: попытки записи подобраны так, чтобы при открытой базе они
 * всё равно не создали данных, но показали, что запись разрешена.
 */
import { readFileSync } from 'node:fs';

const argOf = (name) => {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : undefined;
};

const fromSource = (variable, fallback) => {
  try {
    const text = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
    const match = text.match(new RegExp(`${variable}\\s*=\\s*getEnv\\('[^']+',\\s*'([^']+)'`));
    return match?.[1] ?? fallback;
  } catch {
    return fallback;
  }
};

const URL_BASE = (argOf('url') || process.env.SUPABASE_URL || fromSource('SUPABASE_URL', '')).replace(/\/$/, '');
const ANON = argOf('anon') || process.env.SUPABASE_ANON_KEY || (() => {
  try {
    const text = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
    return text.match(/PROVIDED_KEY\s*=\s*'([^']+)'/)?.[1] ?? '';
  } catch {
    return '';
  }
})();

if (!URL_BASE || !ANON) {
  console.error('Не знаю адрес проекта или публичный ключ. Задайте SUPABASE_URL и SUPABASE_ANON_KEY.');
  process.exit(2);
}

const headers = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };

const request = async (path, init = {}) => {
  try {
    const response = await fetch(`${URL_BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    let body = null;
    try { body = await response.json(); } catch { /* тело не JSON */ }
    return { status: response.status, body };
  } catch (error) {
    return { status: 0, error: error?.cause?.code || error?.code || error.message };
  }
};

let failed = 0;

const probe = async (title, run, verdict) => {
  const result = await run();
  const [ok, detail] = verdict(result);
  if (ok) console.log(`  ок    ${title}`);
  else { failed += 1; console.log(`  БЕДА  ${title}${detail ? ` — ${detail}` : ''}`); }
};

const reachable = await request('/rest/v1/');
if (reachable.status === 0) {
  console.error(`\nДо базы не достучаться: ${reachable.error}.`);
  console.error(`Адрес проекта: ${URL_BASE}`);
  console.error('Если это ENOTFOUND — такого проекта больше нет: имя хоста не разрешается.');
  console.error('Тогда сначала проект надо создать заново, применить supabase/migrations и выложить функции.');
  process.exit(2);
}

console.log(`Проверяю базу ${URL_BASE} публичным ключом\n`);

await probe('витрина читает видимые товары', () => request('/rest/v1/products?select=id&is_visible=eq.true&limit=3'),
  (r) => [r.status === 200 && Array.isArray(r.body), `HTTP ${r.status}`]);

await probe('скрытые товары публично не видны', () => request('/rest/v1/products?select=id&is_visible=eq.false&limit=3'),
  (r) => [r.status !== 200 || (Array.isArray(r.body) && r.body.length === 0), `получено ${JSON.stringify(r.body)?.slice(0, 120)}`]);

await probe('заказы покупателей не читаются', () => request('/rest/v1/orders?select=id&limit=3'),
  (r) => [r.status === 401 || r.status === 403 || (Array.isArray(r.body) && r.body.length === 0), `HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`]);

await probe('покупатели не читаются', () => request('/rest/v1/users?select=telegram_id&limit=3'),
  (r) => [r.status === 401 || r.status === 403 || (Array.isArray(r.body) && r.body.length === 0), `HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`]);

// Заказ без адреса: при закрытой базе отказ придёт до проверки полей, при
// открытой — база дойдёт до ограничения NOT NULL. Данные не создаются ни так,
// ни так, но по ответу видно, пустили ли запись вообще.
await probe('заказ нельзя вставить в обход функции', () => request('/rest/v1/orders', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ items: [], total_price: 1 }),
}), (r) => {
  if (r.status === 401 || r.status === 403) return [true];
  if (r.status === 400 && JSON.stringify(r.body).includes('shipping_address')) {
    return [false, 'запись разрешена: база дошла до проверки полей, значит политики orders_insert_anon ещё нет'];
  }
  if (r.status === 201) return [false, 'заказ действительно создан — база открыта на запись'];
  return [false, `неожиданный ответ HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`];
});

await probe('склад нельзя списать публично', () => request('/rest/v1/rpc/decrement_stock', {
  method: 'POST',
  body: JSON.stringify({ p_id: -1, p_qty: 0 }),
}), (r) => [r.status === 401 || r.status === 403 || r.status === 404, `HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`]);

console.log(`\n${failed === 0 ? 'Граница на месте: публичный ключ видит только витрину.' : `Не прошло проверок: ${failed}. Смотрите supabase/migrations/20260914001000_rls_hardening.sql.`}`);
process.exit(failed === 0 ? 0 : 1);
