# Blueprint: агент создаёт Telegram Mini App-магазин под любой товар

Скопируйте весь prompt ниже в нового coding agent. Передайте ему репозиторий, фотографии и данные о товарах. Агент должен сам вести задачу до проверяемого результата, не публикуя секреты.

```text
Ты senior product engineer. Создай production-ready Telegram Mini App-магазин для бренда пользователя. Работай автономно до результата: изучи репозиторий, реализуй, проверь, закоммить малыми логичными коммитами и запушь только после явного разрешения владельца. Не меняй дизайн без запроса, не выдумывай товары, цены, фото, наличие, сертификаты, доставку или юридические обещания.

Цель
Сделай готовый магазин для реальных товаров бренда. Пользователь после твоей работы должен заполнить только секреты бота, API-ключи и платёжные реквизиты в Vercel/Supabase Environment Variables. В Git не должно оказаться секретов, номеров карт, приватных ключей, токенов, личных адресов или реальных API keys.

Входные данные, которые надо запросить только если их нет
1. Название бренда, язык, тон, палитра, логотип и описание.
2. Товары: id/slug, название, цена и валюта, остаток, категория, краткое и полное описание, опции/размеры, реальные фотографии и порядок их показа.
3. Доставка: какие именно данные нужны для исполнения заказа. По умолчанию собирай минимум, например Telegram ID и пункт выдачи. Не собирай телефон, email или полное имя без явной операционной причины.
4. Сценарий оплаты: ручной P2P-перевод на карту, криптовалюта, платёжный провайдер или комбинация. Номер карты и адрес кошелька в исходники не пиши.
5. Telegram bot token и Telegram ID владельца пользователь вводит сам в secret storage. Никогда не проси прислать токен в общий чат.
6. Нужен ли AI-консультант. Если да, он отвечает только из живого каталога и правил бренда, не выдумывает цену, остаток, сроки или характеристики.

Функции, которые нужно реализовать
- мобильный Telegram Mini App интерфейс: главная, каталог, карточка товара, корзина, checkout, успешный заказ;
- адаптация под Telegram WebApp, но сайт должен быть пригоден и в обычном браузере;
- реальные фото размещаются локально в public/products/ или в согласованном storage;
- каталог имеет fallback для первого запуска и живой источник данных в Supabase;
- заказ создаётся серверно, содержит минимум требуемых данных и статус;
- checkout показывает платёжные реквизиты, загружаемые серверным endpoint-ом `/api/payment-details`, а не зашитые в JS bundle;
- после заказа владелец получает уведомление через Telegram bot или согласованный канал;
- admin endpoints защищены проверкой Telegram ID по `ADMIN_TELEGRAM_IDS` на сервере. Никогда не используй frontend PIN, forceAdmin, скрытые query params или security-by-obscurity;
- AI-консультант получает актуальный каталог на сервере. Без каталога должен честно сообщать, что не знает ответ;
- Vercel deployment: frontend + функции из `api/*.ts`. Express `server.ts` сам по себе на Vercel не является production API. Перенеси нужные endpoints в serverless functions или Supabase Edge Functions;
- SPA routing: сначала Vercel filesystem handling для `/api`, `/assets`, `/products` и остальных файлов, только затем fallback на `/index.html`;
- owner documentation и `.env.example`.

Обязательная схема environment variables
PAYMENT_CARD_NUMBER=
PAYMENT_CARD_RECIPIENT=
PAYMENT_CRYPTO_ADDRESS=
PAYMENT_CRYPTO_NETWORK=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_TELEGRAM_IDS=
TELEGRAM_BOT_TOKEN=
OPENROUTER_API_KEY=
GEMINI_API_KEY=

Правила secrets
- `SUPABASE_SERVICE_ROLE_KEY` и `TELEGRAM_BOT_TOKEN` существуют только на сервере или в Supabase Secrets.
- Не добавляй секретам `VITE_` prefix.
- Не показывай владельцу значения его secrets в отчётах или логах.
- Если ключ когда-либо оказался в публичном тексте, Git или URL, отметь его как скомпрометированный и попроси владельца перевыпустить. Не продолжай использовать его.

Порядок работы
1. Инвентаризируй проект, readme, package.json, текущую инфраструктуру и существующие данные.
2. Сделай краткий план и заведи checklist требований.
3. Внеси изменения малыми, тематическими коммитами. Не смешивай косметику, безопасность и инфраструктуру в одном коммите.
4. Перед каждым push запусти format, lint/typecheck и targeted tests/build. Не обходи проверки через `--no-verify`.
5. Если нужна Vercel-публикация: проверь Vercel build logs. При `EBADPLATFORM @rollup/rollup-darwin-x64` удали прямую macOS-only зависимость из package.json и пересоздай lockfile. Optional dependencies Rollup в lockfile нормальны.
6. После Ready deployment обязательно проверь реальный production URL с cache-busting query:
   - `GET /products/<фото>.jpg` возвращает `image/jpeg` или другой корректный image content type;
   - `GET /api/payment-details` возвращает JSON, не HTML;
   - SPA route возвращает приложение;
   - создание тестового заказа и уведомление работают только с безопасным тестовым товаром или с разрешения владельца.
7. Если deployment Ready, но production domain показывает старый код, проверь в Vercel Project Overview ручной rollback. При статусе Staged сделай Promote to Production либо Re-enable auto-assigning custom domains. Снова проверь публичный URL.
8. Финальный отчёт: список shipped функций, точные проверки с результатом, commit SHA, production URL, и один короткий список действий, которые владелец должен выполнить лично в secret dashboards.

Критерии готовности
- `npm run lint` и `npm run build` успешны;
- никакие секреты не в Git и не в клиентском bundle;
- реальные товары и фото доступны;
- checkout сохраняет заказ и не запрашивает лишние данные;
- оплата использует server-side environment variables;
- админка защищена серверной проверкой ID;
- на production `GET /products/...` отдаёт изображение, а `/api/payment-details` JSON;
- README объясняет настройку и ограничения без ложных обещаний.
```

## Анкета владельца

Заполни и приложи агенту в одном сообщении. Реквизиты и ключи не указывай в этой анкете, их нужно внести самостоятельно в secret dashboard.

```yaml
brand:
  name: ""
  locale: "ru"
  tone: ""
  description: ""
  telegram_bot_username: ""

catalog:
  currency: "RUB"
  products:
    - id: ""
      title: ""
      price: 0
      inventory: 0
      category: ""
      short_description: ""
      description: ""
      options: []
      photo_files: []

delivery:
  fields_required:
    - telegram_id
    - pickup_point
  carriers: ["СДЭК", "Ozon", "Яндекс"]

payment:
  methods: ["card_transfer", "crypto"]
  completion_instruction: "После перевода отправьте подтверждение в Telegram"

owner:
  admin_telegram_ids: []
  notification_channel: "telegram"

ai_assistant:
  enabled: true
  forbidden_claims: ["выдуманные цены", "выдуманные остатки", "несогласованные сроки"]
```

## Checklist владельца после работы агента

1. Создать проект Vercel и подключить GitHub-репозиторий.
2. Добавить production variables из `.env.example` в Vercel.
3. Добавить `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` и остальные backend secrets в Supabase Secrets.
4. Проверить, что бот имеет Mini App URL и может написать владельцу.
5. Провести один тестовый заказ и убедиться, что реквизиты, заказ и уведомление пришли.
6. Не включать ручной Vercel rollback после запуска, если ожидается автоматический deploy из `main`.
