-- ВНИМАНИЕ: НЕ ПРИМЕНЯТЬ к боевой базе магазина.
-- Этот файл — реконструкция по памяти, а не описание живой схемы: в базе 9
-- таблиц, позиции заказа лежат в order_items, колонок orders.items,
-- customer_name, phone и address там нет. Живая схема — в docs/SUPABASE_SETUP.md.
-- Применение этого файла к боевой базе сломает её.

-- Замок на публичный ключ.
--
-- Клиент магазина ходит в базу с anon-ключом, а этот ключ публичный: он лежит
-- в бандле и виден любому, кто откроет сайт. Значит вся граница доступа
-- держится на RLS, и политики из первой миграции её не держат:
--
--   users_read_own       using (true) — «своя строка» для anon это любая
--                                       строка: читаются все покупатели;
--   users_update_own     using (true) — правятся тоже любые строки;
--   users_insert_own     with check (true) — строки создаёт кто угодно;
--   orders_insert_anon   with check (true) — заказ вставляется напрямую, минуя
--                                       функцию и все её проверки: цену по
--                                       каталогу, наличие, подпись Telegram;
--   products_read_all_authenticated — в магазине нет входа через Supabase Auth,
--                                       роль authenticated здесь никому не нужна;
--   grant execute on decrement_stock to anon — склад списывает кто угодно.
--
-- Магазину ничего из этого не нужно. Витрина читает только каталог, а заказы,
-- покупатели и склад идут через Edge Function с service_role, который RLS
-- обходит. Политик для orders и users после этой миграции не остаётся вовсе —
-- и это правильное состояние: по умолчанию запрещено всё.

alter table public.products enable row level security;
alter table public.users enable row level security;
alter table public.orders enable row level security;

drop policy if exists "users_read_own" on public.users;
drop policy if exists "users_update_own" on public.users;
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "orders_insert_anon" on public.orders;
drop policy if exists "products_read_all_authenticated" on public.products;

revoke execute on function public.decrement_stock(bigint, int) from anon, authenticated;

-- Каталог остаётся читаемым публично, но только витриной:
-- политика products_read_visible_anon (is_visible = true) создана первой
-- миграцией и здесь не трогается. Скрытые товары видит только сервер.
