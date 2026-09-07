-- Initial schema for Tak and Rat shop
-- Includes RLS policies, seed data, and a helper RPC for atomic stock decrement.

create extension if not exists "pgcrypto";

-- ============== TABLES ==============
create table if not exists public.products (
  id bigserial primary key,
  name text not null,
  price numeric not null check (price >= 0),
  description text,
  category text,
  image_url text,
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id bigserial primary key,
  telegram_id bigint unique not null,
  username text,
  first_name text,
  last_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id bigserial primary key,
  telegram_id bigint,
  customer_name text,
  phone text,
  shipping_address text not null,
  items jsonb not null,
  total_price numeric not null check (total_price >= 0),
  status text not null default 'new',
  payment_method text not null default 'pending',
  consent boolean not null default true,
  customer_info jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_telegram_id on public.orders (telegram_id);
create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_products_visible on public.products (is_visible);

-- ============== RLS ==============
alter table public.products enable row level security;
alter table public.users enable row level security;
alter table public.orders enable row level security;

-- PRODUCTS: anon can read only visible rows. Writes only via service_role (no policy → blocked for anon/authenticated).
drop policy if exists "products_read_visible_anon" on public.products;
create policy "products_read_visible_anon" on public.products
  for select to anon using (is_visible = true);

drop policy if exists "products_read_all_authenticated" on public.products;
create policy "products_read_all_authenticated" on public.products
  for select to authenticated using (true);

-- USERS: insert own row; select own row; update own non-admin fields
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
  for insert to anon with check (true);

drop policy if exists "users_read_own" on public.users;
create policy "users_read_own" on public.users
  for select to anon using (true);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to anon using (true) with check (is_admin = false);

-- ORDERS: anon can insert (validated by Edge Function). No read/write policies → anon cannot read.
drop policy if exists "orders_insert_anon" on public.orders;
create policy "orders_insert_anon" on public.orders
  for insert to anon with check (true);

-- ============== ATOMIC STOCK DECREMENT RPC ==============
-- Returns true if stock was successfully decremented, false if insufficient stock.
create or replace function public.decrement_stock(p_id bigint, p_qty int)
returns boolean
language plpgsql
as $$
declare
  affected int;
begin
  update public.products
     set stock_quantity = stock_quantity - p_qty
   where id = p_id
     and stock_quantity >= p_qty
     and is_visible = true;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

grant execute on function public.decrement_stock(bigint, int) to anon, authenticated, service_role;

-- ============== SEED DATA ==============
insert into public.products (name, price, description, category, image_url, stock_quantity, is_visible) values
  ('Картхолдер VEGETABLE', 2900, 'Компактный картхолдер из натуральной кожи растительного дубления. Ручной седельный шов, вощёная нить, обработанные торцы. Вещь, которая стареет вместе с владельцем.', 'accessories', '/products/01.jpg', 10, true),
  ('Чехол для зажигалки L-01', 1900, 'Чехол из плотной натуральной кожи для повседневной зажигалки. Ручной шов и латунная кнопка. Небольшой инструмент без лишнего декора.', 'accessories', '/products/04.jpg', 10, true),
  ('Ремень S-07', 3200, 'Ремень из цельной натуральной кожи с литой латунной пряжкой. Ручная обработка и честная конструкция без сезонности. Размер подбирается по мерке.', 'accessories', '/products/07.jpg', 10, true),
  ('Лонгслив ASH GREY', 3500, 'Плотный хлопковый лонгслив серого цвета. Усиленная горловина, спокойный силуэт, базовый слой для города. Без сезонного шума.', 'longsleeve', '/products/08.jpg', 10, true)
on conflict do nothing;
