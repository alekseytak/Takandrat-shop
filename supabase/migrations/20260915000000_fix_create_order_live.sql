-- Починка функции создания заказа под ЖИВУЮ схему базы.
--
-- Было две беды. Первая: create_order писала в orders.customer_name,
-- orders.phone, orders.address и order_items.price_cents — таких колонок в
-- базе нет, заказ падал с 400 column "customer_name" ... does not exist.
-- Вторая: функция объявляла идентификаторы как uuid, а в базе все ключи
-- bigint (products.id, orders.id, order_items.product_id), поэтому даже
-- исправленная по колонкам функция падала с operator does not exist:
-- bigint = uuid.
--
-- Стало: имя, телефон и ключ идемпотентности складываются в orders.customer_info
-- (jsonb), адрес — в orders.shipping_address, цена позиции — в
-- order_items.price_at_time, размер — в order_items.selected_size. Сумма
-- считается по каталогу, а не по тому, что прислал браузер.
--
-- Возвращает bigint (orders.id), а не uuid: тип изменился, поэтому функция
-- сначала удаляется. Право на вызов — только у служебной роли: заказ создаёт
-- функция admin-ai после проверки подписи Telegram, а не кто угодно с улицы.
--
-- Применено к живой базе 14 сентября через Management API (личный токен).
-- Источник правды — база: см. docs/SUPABASE_SETUP.md.
DROP FUNCTION IF EXISTS public.create_order(jsonb);

CREATE FUNCTION public.create_order(payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order_id bigint;
  v_total numeric := 0;
  v_items jsonb := coalesce(payload -> 'items', '[]'::jsonb);
BEGIN
  -- Цена и сумма — только из каталога: тому, что прислал клиент, не верим.
  SELECT coalesce(sum(p.price * (item ->> 'quantity')::int), 0)
    INTO v_total
    FROM jsonb_array_elements(v_items) AS item
    JOIN public.products p ON p.id = (item ->> 'product_id')::bigint;

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
         (item ->> 'product_id')::bigint,
         (item ->> 'quantity')::int,
         (SELECT p.price FROM public.products p WHERE p.id = (item ->> 'product_id')::bigint),
         item ->> 'size',
         now()
    FROM jsonb_array_elements(v_items) AS item;

  RETURN v_order_id;
END;
$function$;

-- В Supabase новые функции в схеме public по умолчанию выдаются ролям anon и
-- authenticated: отзыва у PUBLIC мало, публичный ключ всё равно создавал заказы
-- (проверено: заказ 13 создался анонимно). Отзываем явно у каждой роли.
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO service_role;
