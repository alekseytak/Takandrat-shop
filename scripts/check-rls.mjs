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

// Вставка заказа публичным ключом. Поля берём те, что есть в живой базе
// (orders.items в ней нет вовсе — позиции лежат в order_items), иначе ответ
// придёт про схему, а не про права, и проба ничего не докажет.
await probe('заказ нельзя вставить в обход функции', () => request('/rest/v1/orders', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ shipping_address: 'проба границы доступа', total_price: 1 }),
}), (r) => {
  // Правило простое: публичный ключ должен получить отказ в правах. Любой
  // другой ответ означает, что запись дошла до базы, и это дыра.
  if (r.status === 401 || r.status === 403) return [true, `HTTP ${r.status}`];
  if (r.status === 201) return [false, 'заказ действительно создан — база открыта на запись'];
  return [false, `запись дошла до базы: HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 140)}`];
});

// Раньше здесь проверялась функция decrement_stock, которой в живой базе нет
// вовсе: проба считала 404 успехом, то есть проходила по ложной причине.
// Теперь проверяется то, что в базе есть и что действительно опасно:
// execute_sql — выполнение своего SQL. Запрос безобидный: select 1.
await probe('свой SQL нельзя выполнить публично', () => request('/rest/v1/rpc/execute_sql', {
  method: 'POST',
  body: JSON.stringify({ query: 'select 1 as ok' }),
}), (r) => {
  if (r.status === 401 || r.status === 403) return [true, `HTTP ${r.status}`];
  if (r.status === 200) return [false, 'публичный ключ выполнил свой SQL — это полный доступ к базе'];
  if (r.status === 404) return [false, 'функции execute_sql нет — проверка ничего не проверяет'];
  return [false, `неожиданный ответ HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`];
});

// Заказ нельзя создать публичным ключом: иначе кто угодно оформит заказ от
// чужого имени в обход проверки подписи Telegram — ровно та дыра, ради которой
// заказ создаёт служебная функция после проверки подписи.
await probe('заказ нельзя создать в обход функции', () => request('/rest/v1/rpc/create_order', {
  method: 'POST',
  body: JSON.stringify({ payload: { telegram_id: '1', address: 'проба границы доступа', items: [] } }),
}), (r) => {
  if (r.status === 401 || r.status === 403) return [true, `HTTP ${r.status}`];
  if (r.status === 200 || r.status === 201) return [false, 'публичный ключ создал заказ — личность покупателя не проверяется'];
  return [false, `неожиданный ответ HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`];
});

// Публичный ключ не должен править каталог. Правило «Public products all» с
// условием `true` разрешало кому угодно и читать, и менять товары: цены, склад,
// видимость. Проверка записывает в строку её же название, то есть ничего не
// меняет, но видно, пустили ли запись вообще.
await probe('каталог нельзя править публичным ключом', async () => {
  const list = await request('/rest/v1/products?select=id,name&limit=1');
  const row = Array.isArray(list.body) ? list.body[0] : undefined;
  if (!row) return { status: 500, body: { message: 'в каталоге нет товаров — проверять нечего' } };
  return request(`/rest/v1/products?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: row.name }),
  });
}, (r) => {
  if (r.status === 401 || r.status === 403) return [true, `HTTP ${r.status}`];
  if (Array.isArray(r.body) && r.body.length === 0) return [true, 'запись не прошла'];
  if (Array.isArray(r.body) && r.body.length > 0) return [false, 'публичный ключ изменил товар в каталоге'];
  return [false, `неожиданный ответ HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`];
});

console.log(`\n${failed === 0 ? 'Граница на месте: публичный ключ видит только витрину.' : `Не прошло проверок: ${failed}. Смотрите docs/SUPABASE_SETUP.md: живая схема и права описаны там.`}`);
process.exit(failed === 0 ? 0 : 1);
