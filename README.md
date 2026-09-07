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
- Vercel-ready frontend, статические фотографии и endpoint `GET /api/payment-details`.

## Быстрый старт

```bash
npm ci
cp .env.example .env
npm run dev
```

Проверки перед публикацией:

```bash
npm run lint
npm run build
```

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
| `SUPABASE_URL` | Vercel, Supabase Functions | URL проекта Supabase. |
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
- `src/components/Checkout.tsx` — минимальный checkout и отображение реквизитов.
- `api/payment-details.ts` — Vercel Serverless Function для реквизитов оплаты.
- `supabase/functions/admin-ai/index.ts` — создание заказов, управление данными, уведомления.
- `supabase/functions/telegram-bot/index.ts` — Telegram-бот.
- `server.ts` — локальный Node runtime и AI-маршруты. Для Vercel каждый production API должен быть перенесён в `api/*.ts` или Supabase Edge Functions.
- `docs/AGENT_STORE_BLUEPRINT.md` — готовый prompt для агента, создающего магазин под любой товар.

## Ограничения текущей production-версии

На Vercel из `server.ts` не запускаются Express-маршруты. Production-ready endpoint в этом репозитории сейчас: `/api/payment-details`. Заказы и админ-операции должны выполняться через Supabase Edge Functions. Для AI chat потребуется отдельная Vercel Function или вызов Supabase Edge Function.
