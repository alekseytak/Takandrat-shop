-- Починка функции создания заказа под ЖИВУЮ схему базы.
--
-- Было: create_order писала в orders.customer_name, orders.phone, orders.address
-- и order_items.price_cents — таких колонок в базе нет, и любой заказ падал с
-- 400 column "customer_name" of relation "orders" does not exist.
--
-- Стало: имя, телефон и ключ идемпотентности складываются в orders.customer_info
-- (jsonb), адрес — в orders.shipping_address, цена позиции — в
-- order_items.price_at_time, размер — в order_items.selected_size.
-- Сумма заказа считается по каталогу, а не по тому, что прислал браузер.
--
-- Применено к живой базе 14 сентября через execute_sql служебным ключом.
-- Источник правды — база: см. docs/SUPABASE_SETUP.md.
CREATE OR REPLACE FUNCTION public.create_order(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_order_id uuid;
  v_total numeric := 0;
  v_items jsonb := coalesce(payload -> 'items', '[]'::jsonb);
BEGIN
  -- Цена и сумма — только из каталога: тому, что прислал клиент, не верим.
  SELECT coalesce(sum(p.price * (item ->> 'quantity')::int), 0)
    INTO v_total
    FROM jsonb_array_elements(v_items) AS item
    JOIN public.products p ON p.id = (item ->> 'product_id')::uuid;

  INSERT INTO public.orders (telegram_id, total_price, status, shipping_address, customer_info, created_at, updated_at)
  VALUES (
    nullif(payload ->> 'telegram_id', '')::bigint,
    v_total,
    'pending',
    payload ->> 'address',
    jsonb_strip_nulls(jsonb_build_object(
      'name', payload ->> 'customer_name',
      'phone', payload ->> 'phone',
      'idempotency_key', payload ->> 'idempotency_key'
    )),
    now(),
    now()
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_id, quantity, price_at_time, selected_size, created_at)
  SELECT v_order_id,
         (item ->> 'product_id')::uuid,
         (item ->> 'quantity')::int,
         (SELECT p.price FROM public.products p WHERE p.id = (item ->> 'product_id')::uuid),
         item ->> 'size',
         now()
    FROM jsonb_array_elements(v_items) AS item;

  RETURN v_order_id;
END;
$function$;
