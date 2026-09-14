# Tak and Rat Shop

Telegram Mini App-магазин для ручных изделий и одежды. Репозиторий одновременно служит **рабочим магазином** и **шаблоном для агентского развёртывания магазина любого товара**.

> Реальные ключи, номера карт, адреса кошельков и токены никогда не добавляются в Git. Заполняйте их только в настройках окружения Vercel и Supabase.

## Что уже реализовано

- каталог с реальными товарами, категориями, ценами, остатками и несколькими фото;
- Telegram Mini App-интерфейс с корзиной и checkout;
- сбор минимума данных: Telegram ID и адрес ПВЗ;
- ручная P2P-оплата картой и криптовалютой через защищённый serverless endpoint;
- уведомление владельцу о новом заказе через Supabase Edge Function;
- админ-доступ по whitelist Telegram ID, без PIN в клиентском коде;
- магазинный AI-ассистент, который получает каталог из базы и не должен выдумывать цену или наличие;
- Vercel-ready frontend, статические фотографии и endpoint `GET /api/payment-details`;
- витрина работает и без базы: если каталог в Supabase не ответил за 4 секунды,
  показывается встроенный каталог из `src/constants.ts`, а не бесконечная
  загрузка;
- сервер не верит цене из браузера: сумма, наличие и состав заказа считаются
  по каталогу внутри Edge Function.

## Быстрый старт

```bash
npm ci
cp .env.example .env
npm run dev
```

Проверки перед публикацией:

```bash
npm run factory calibrate   # проверка, что проверка фабрики умеет говорить «нет»
npm run mail address        # адрес временного ящика агента

npm run lint         # типы
npm run build        # сборка
npm run check:order     # правила заказа: цена, количество, наличие (26 проверок)
npm run check:telegram  # подпись Telegram: подделка, чужой токен, просрочка (16 проверок)
npm run check:idempotency  # повтор заказа не создаёт второй (16 проверок)
npm run check:admin     # права владельца: заказы, склад, скрытые товары (30 проверок)
npm run check:rls       # граница доступа к базе публичным ключом
npm run check:shop   # витрина, корзина, оформление, стили в браузере (26 проверок)
```

`check:shop` требует запущенного магазина: проверка сама открывает headless
Chrome, кладёт товар в корзину, доходит до оформления и убеждается, что при
недоступном сервере покупатель видит понятную причину, а корзина остаётся на
месте. Реальный заказ не создаётся.

Проверять надо оба режима — они собираются по-разному:

```bash
npm run dev &                                    # разработка, Vite middleware
npm run check:shop

npm run build && NODE_ENV=production npm start &  # то, что уезжает на сервер
SHOP_URL=http://127.0.0.1:3000/ npm run check:shop
```

Так и были найдены две поломки, которых не видно в dev-режиме: `npm start`
падал на импорте без расширения, а Express 5 не принимал маршрут-заглушку
`'*'`. Обе починены.

## Настройка владельцем

1. Создайте проект Supabase и примените схему каталога и заказов, используемую приложением.
2. Создайте бота в `@BotFather`, добавьте Mini App URL после деплоя и получите токен бота. Токен храните только в Supabase Secrets.
3. В Vercel создайте проект из этого GitHub-репозитория. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. В Vercel добавьте Production environment variables из следующей таблицы.
5. В Supabase Edge Functions добавьте сервисные secrets, включая токен Telegram-бота и service-role key.
6. Добавьте реальные товары и фото. Фото кладите в `public/products/`, затем указывайте пути в каталоге.
7. Перед запуском проверьте `npm run lint`, `npm run build`, заказ из Telegram и уведомление владельцу.

## Переменные окружения

| Переменная | Где нужна | Назначение |
|---|---|---|
| `PAYMENT_CARD_NUMBER` | Vercel | Номер карты для ручной оплаты. Без пробелов. |
| `PAYMENT_CARD_RECIPIENT` | Vercel | Получатель платежа, например имя владельца. |
| `PAYMENT_CRYPTO_ADDRESS` | Vercel | Адрес криптокошелька. |
| `PAYMENT_CRYPTO_NETWORK` | Vercel | Сеть кошелька, например `SOL` или `TRC20`. |
| `SUPABASE_URL` | Vercel, Supabase Functions | URL проекта Supabase. Клиент читает его как `VITE_SUPABASE_URL` (или `SUPABASE_URL`); без переменной используется боевой адрес из `src/lib/supabase.ts`. |
| `SUPABASE_ANON_KEY` | Vercel | Публичный anon key Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Только сервер и Supabase Functions | Сервисный ключ. Не передавать клиенту. |
| `ADMIN_TELEGRAM_IDS` | Сервер и Supabase Functions | Telegram ID администраторов через запятую. |
| `OPENROUTER_API_KEY` | Сервер, опционально | Ключ AI-ассистента. |
| `GEMINI_API_KEY` | Сервер, опционально | Ключ Gemini, если используется. |
| `TELEGRAM_BOT_TOKEN` | Только Supabase Secrets | Токен бота для уведомлений. |

### Правила безопасности

- Не вставляйте секреты в `src/`, `constants.ts`, `README.md`, `vercel.json` или commit message.
- Не используйте `SUPABASE_SERVICE_ROLE_KEY` в браузере и не добавляйте префикс `VITE_`.
- Карта и криптокошелёк возвращаются только endpoint-ом `api/payment-details.ts`, куда Vercel подставляет secrets во время выполнения.
- Ограничивайте админ-функции `ADMIN_TELEGRAM_IDS`. Не делайте admin PIN на фронтенде.
- Если ключ был опубликован в чате, URL или коммите, немедленно перевыпустите его.

## Публикация на Vercel

`vercel.json` сначала отдаёт реальные файлы и `/api/*`, затем делает SPA fallback на `index.html`. Это обязательно, иначе путь к фотографии или API может начать возвращать HTML магазина.

После deploy проверьте:

```bash
curl -I https://YOUR-DOMAIN/products/01.jpg
# Ожидается: content-type: image/jpeg

curl https://YOUR-DOMAIN/api/payment-details
# Ожидается JSON c card/cardRecipient/crypto/cryptoNetwork, не HTML
```

Если Vercel пишет `EBADPLATFORM` про `@rollup/rollup-darwin-x64`, не добавляйте этот пакет в `dependencies` или `devDependencies`. Это macOS-only optional package Rollup. Удалите прямую зависимость и обновите lockfile через `npm install` или `npm uninstall @rollup/rollup-darwin-x64`.

Если deployment `Ready`, но домен показывает старую версию, откройте Vercel Project → Overview. Проверьте, нет ли `Rolled back`. При ручном rollback новые deploy имеют статус `Staged` и custom domain не назначается. Нажмите **promote to production** или **re-enable auto-assigning custom domains**, затем повторите две проверки выше.

## Структура

- `src/constants.ts` — fallback-каталог и брендовые тексты.
- `src/index.css` и `tailwind.config.js` — стили витрины: Tailwind собирается
  через PostCSS вместе с приложением, без внешнего CDN.
- `supabase/functions/admin-ai/telegram.ts` — проверка подписи Telegram: по ней
  видно, кто заказывает.
- `supabase/functions/admin-ai/idempotency.ts` — повтор заказа не создаёт второй.
- `supabase/functions/admin-ai/admin.ts` — кто владелец: заказы покупателей,
  склад и скрытые товары доступны только ему.
- `supabase/migrations/` — схема базы и правила доступа. Порядок восстановления
  и проверка границы — [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).
- `src/components/Checkout.tsx` — минимальный checkout: состав заказа и реквизиты.
- `src/lib/orderError.ts` — перевод причин отказа сервера на русский; список причин взят из `order.ts`, поэтому новая причина не может остаться без объяснения.
- `supabase/functions/admin-ai/order.ts` — проверки и расчёт заказа по каталогу.
- `scripts/shop-smoke.mjs` — сквозная проверка витрины и корзины в браузере; адрес задаётся через `SHOP_URL`.
- `tools/factory.ts` — фабрика контента: правка фото товара моделями со сверкой
  с исходником по списку свойств. Что шлюз умеет и почему черновики
  отклоняются — [`docs/CONTENT_FACTORY.md`](docs/CONTENT_FACTORY.md).
- `tools/mail.mjs` — временный ящик для регистраций в сервисах.
- `api/payment-details.ts` — Vercel Serverless Function для реквизитов оплаты.
- `supabase/functions/admin-ai/index.ts` — создание заказов, управление данными, уведомления.
- `supabase/functions/telegram-bot/index.ts` — Telegram-бот.
- `server.ts` — локальный Node runtime и AI-маршруты. Для Vercel каждый production API должен быть перенесён в `api/*.ts` или Supabase Edge Functions.
- `docs/AGENT_STORE_BLUEPRINT.md` — готовый prompt для агента, создающего магазин под любой товар.

## Зависимости

В дереве было 588 пакетов. Четыре дерева лежали без единого импорта в коде —
`three`, `@react-three/fiber`, `@react-three/drei`, `firebase` — и вместе с
ними ушло 140 пакетов: осталось 448. Размер собранной витрины от этого не
изменился (418,89 кБ): в бандл они и не попадали, вес был только в установке и
в обновлениях.

`@vercel/node` переехал в `devDependencies`: он нужен лишь для типов
`api/payment-details.ts`.

`npm audit fix` закрыл десять уязвимостей, осталось 7 (3 moderate, 4 high).
Все они в инструментах сборки и деплоя, к покупателю не попадают, и все
требуют мажорных обновлений: `ajv` и `path-to-regexp` тянутся через
`@vercel/node` 5 → 13, `esbuild` — через `vite` 5 → 7. Это отдельная миграция
вместе с `@vitejs/plugin-react` 6 и, вероятно, React 19, а не побочный эффект
уборки. Заодно в мажоре ждут `tailwindcss` 3 → 4 (сейчас стили приходят
скриптом CDN, см. слабое место 3) и `@supabase/supabase-js` 2.102 → 2.116
(это обновление безопасное, но не сделано).

## Известные слабые места

Честный список того, что требует решения владельца:

0. **Проекта Supabase, на который ссылается магазин, больше нет.** Имя хоста
   `xxkafurxhvcwlzabawm.supabase.co` не разрешается. Пока проект не создан
   заново, витрина берёт каталог из `src/constants.ts`, а заказы не создаются.
   Схема сохранена в репозитории, порядок восстановления —
   [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).
1. **Приём заказов требует секрета в самой функции.** Подпись Telegram
   проверяется (`telegram.ts`, 16 проверок), и покупатель берётся из подписи, а
   не из тела запроса. Но если у функции `admin-ai` не задан
   `TELEGRAM_BOT_TOKEN`, проверить подпись нечем — тогда функция отвечает
   отказом (503) и заказы не принимаются вовсе. Это сделано намеренно: молча
   принимать непроверенные заказы хуже, чем не принимать никаких. После
   выкладки проверьте, что секрет на месте.
   Следствие: оформить заказ из обычного браузера теперь нельзя — только из
   мини-приложения Telegram, и это и есть задуманное поведение.
2. **Защита от дублей не проверена на живой базе.** Покупатель присылает ключ
   на всю попытку оформления, и по знакомому ключу сервер возвращает прежний
   заказ вместо нового. Логика покрыта 16 проверками, но сам поиск по ключу
   идёт в jsonb-поле `customer_info` и написан вслепую: отсюда Supabase
   недоступен. Проверить надо один раз вживую — оформить заказ дважды с одним
   ключом и убедиться, что в базе одна строка. Если запрос не поддержит разбор
   jsonb, в `customer_info` останется `idempotency_checked: false`, а заказ
   всё равно создастся: потерять заказ хуже, чем получить дубль.
3. **Стили теперь свои, но классы надо писать целиком.** Tailwind собирает
   `src/index.css` через PostCSS, CDN убран. Отличие от CDN важное: он сканировал
   живую страницу, а сборка видит только текст в файлах. Класс, собранный из
   кусков в рантайме (`bg-` плюс цвет из переменной), молча не получит правил. Это
   ловит `check:shop`: он сверяет классы на странице с правилами в стилях.

Подробности про деньги, цены и состав заказа — в
`docs/ORDER_AND_PAYMENT_BOUNDARY.md`.

## Ограничения текущей production-версии

На Vercel из `server.ts` не запускаются Express-маршруты. Production-ready endpoint в этом репозитории сейчас: `/api/payment-details`. Заказы и админ-операции должны выполняться через Supabase Edge Functions. Для AI chat потребуется отдельная Vercel Function или вызов Supabase Edge Function.
