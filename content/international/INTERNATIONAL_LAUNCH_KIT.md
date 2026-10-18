# Пакет выкладки «ТАК И РАТ» (TAK & RAT) на зарубежные площадки

Этот файл содержит черновики данных, текстов и карточек товаров для четырёх каналов международных продаж без посредников. **Веса, габариты и коды ТН ВЭД/HS — неподтверждённые оценки**: перед отправкой их нужно проверить фактическим взвешиванием/обмером и классификацией.

---

## 1. Nostr / Shopstr.store (Крипто-маркетплейс без KYC)

Профиль и 5 товаров были подписаны (BIP-340 Schnorr) и отправлены в релеи (`wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`). **Подтверждение релеем означает только то, что событие принято в релей — это не подтверждение работающего оформления заказа в Shopstr и не подтверждение того, что площадка допускает этот магазин по своим правилам.** И то, и другое нужно проверить отдельно на самой площадке.

- **Публичный ID (npub):** `npub1vvzh43xykcph8ajthsxhd2calhudv3dp25pj7eu5672729sxl3gsz46z7c`
- **Секретный ключ для входа (`nsec`):** хранится локально на твоем компьютере в файле `~/.takandrat/nostr.json` (права `600`, в git не попадает).
- **Как войти на Shopstr.store:**
  1. **Не вставляй секретный ключ (`nsec`) в чужой сайт.** Рекомендуемый путь — вход через доверенный локальный подписант (расширение Alby / Nos2x), где ключ не покидает браузерного хранилища. Вставка `nsec1...` прямо в поле на сайте отдаёт полный контроль над аккаунтом сайту.
  2. Посмотреть свой профиль и карточки в сети Nostr можно по ссылке: `https://njump.me/npub1vvzh43xykcph8ajthsxhd2calhudv3dp25pj7eu5672729sxl3gsz46z7c`
  3. Для повторного обновления карточек в релеях одной командой: `node tools/nostr-shop.mjs publish`.

---

## 2. Почта под регистрацию Reddit / Grailed / Ko-fi (временная — только для одноразовых регистраций)

В репозитории поднят временный почтовый ящик (`tools/mail.mjs`):
- **Email:** `tak-rat-440e17@uberip.com` (токен и пароль лежат в `~/.takandrat/mail.json`).
- **Важно: это временный ящик — для длительного бизнеса он не подходит.** Домен одноразовый, срок жизни адреса и его содержимого не гарантирован; привязывать к нему аккаунты магазина, от которых зависит продажа (восстановление доступа, сообщения покупателей), нельзя. Для бизнес-аккаунтов завести постоянный почтовый адрес.
- **Как прочитать письмо с кодом от Reddit / площадки:**
  ```bash
  node tools/mail.mjs wait     # ждёт входящее письмо и сразу печатает код и ссылку
  node tools/mail.mjs list     # список всех пришедших писем
  ```
- **Рекомендуемые свободные ники для регистрации на Reddit и Grailed:**
  - `takandrat_atelier`
  - `takandrat_objects`
  - `tak_and_rat`

---

## 3. Готовые посты для Reddit (`r/LeatherClassifieds`, `r/EDCexchange`, `r/Leathercraft`)

> **Правило модераторов `r/LeatherClassifieds` и `r/EDCexchange` (требует проверки перед публикацией):**
> По распространённым правилам этих сабреддитов на первом фото рядом с изделием должен лежать листок бумаги, где от руки написан ник на Reddit и дата. **Это правило здесь не проверено по актуальному кодексу каждого сабреддита** — перед публикацией перечитать правила конкретного сабреддита. В `r/Leathercraft` листок формально не требуется, но и это нужно сверить с их правилами.

### Пост №1 для `r/LeatherClassifieds` (Прямая продажа — комиссии 0%)

**Title:**
`[WTS] Hand-Stitched Vegetable-Tanned Leather EDC Objects: Card Containers (#04, #09), BIC Lighter Sleeve (#27) & 35mm Single-Piece Brass Belt (R-07) — $35 to $110`

**Body (скопировать целиком):**
```markdown
Timestamp photo (handwritten nick + date) and Album: [сделать реальное фото с подписанным листком — ссылка на сайт не считается timestamp-фото для r/LeatherClassifieds / r/EDCexchange]

Hello everyone, I am Alexey from the **TAK & RAT** atelier (Saint Petersburg). I build minimalist, unlined vegetable-tanned leather objects designed around structural mechanics rather than decorative filler.

All leather pieces are vegetable-tanned and saddle-stitched by hand with waxed thread. Edges are burnished so the leather holds its geometry without glue or synthetic lining.

### Available Objects (In stock: 2 pcs each, further pieces made to order):

1. **Fire Container. Object #27 (Full-size BIC Lighter Sleeve)** — **$35**
   - Sized for a standard full-size BIC lighter (точную посадку и удержание проверить на фактическом изделии — не заявлять «never slips» без проверки).
   - Solid keyring loop. The leather shell darkens and ages over years while disposable cores are replaced.

2. **Card Container. Object #04 (Minimalist 2-Card Holder)** — **$65**
   - Two compartments built strictly for two cards — not for "everything at once".
   - Hand-sewn with waxed thread, burnished edges, zero lining.

3. **Double Card Container. Object #09 (Bifold Architecture)** — **$85**
   - Bifold layout: two opposing compartments so cards lie flat rather than stacked.
    - Vegetable-tanned leather, hand saddle-stitched.

4. **35mm Single-Piece Leather Belt R-07 + Solid Cast Brass Buckle** — **$110**
   - Cut from a single strap of veg-tan leather (35 mm / 1.38" wide), not laminated from layers.
   - Solid cast brass buckle.
   - Sized by denim waist `W` (по таблице владельца, S — W30–W31, M — W32–W33, L — W34–W36, XL — W38–W40; перевод в сантиметры: W × 2,54).

---

### Payment & Worldwide Shipping
- **Shipping:** условия (стоимость, сроки, служба) не подтверждены — до публикации уточнить фактические тарифы СДЭК Global / международной почты и вписать реальные цифры вместо обещаний.
- **Payment:** Direct Crypto (**USDT / USDC / SOL / TON**) via our English storefront or DM me here / on Telegram (`@takandrat_bot`).
- **Catalog & High-Res Photos:** https://takandrat-shop.vercel.app/?lang=en&currency=usd
```

---

### Пост №2 для `r/EDC` и `r/Leathercraft` (Органический охват без прямой рекламы в заголовке)

**Title:**
`Object #27 & Object #04 — Unlined vegetable-tanned leather BIC sleeve and two-card container I hand-stitched this week`

**First Comment (оставить сразу под своим постом):**
```markdown
Both pieces are vegetable-tanned leather, hand-sewn with waxed thread.

- **Object #27 (BIC Case):** Built specifically for the geometry of a full-size BIC (посадку и удержание проверить на изделии).
- **Object #04 (Card Container):** Strictly two compartments. No glue, no fabric lining — the thickness of the leather itself keeps the frame rigid.

If anyone wants to check the full specs or grab one, our English atelier catalog is up at https://takandrat-shop.vercel.app/?lang=en&currency=usd
```

---

## 4. Готовые листинги для Grailed и Etsy (Copy-Paste + 13 SEO-тегов)

### Object #04 — Card Container ($65 / €60)
- **Title (Etsy / Grailed):** `Hand Stitched Vegetable Tanned Leather Card Holder Object 04 Minimalist Unlined Slim Wallet`
- **Category:** Accessories → Wallets & Money Clips → Card Cases
- **13 Etsy Tags (ровно до 20 символов каждый, через запятую):**
  `veg tan wallet, leather card holder, saddle stitched, minimalist wallet, edc card case, unlined leather, brutalist wallet, front pocket wallet, raw leather wallet, handmade cardholder, artisan leather, object 04`

### Object #09 — Double Card Container ($85 / €80)
- **Title (Etsy / Grailed):** `Bifold Vegetable Tanned Leather Card Wallet Object 09 Hand Sewn Minimalist Cardholder`
- **Category:** Accessories → Wallets & Money Clips
- **13 Etsy Tags:**
  `bifold card wallet, veg tan bifold, hand sewn wallet, flat card holder, edc leather gear, saddle stitch wallet, minimalist bifold, unlined card case, raw veg tan leather, mens leather wallet, artisan bifold, heritage leather`

### Object #27 — Fire Container / BIC Case ($35 / €32)
- **Title (Etsy / Grailed):** `Vegetable Tanned Leather BIC Lighter Case Object 27 Hand Stitched EDC Keychain Lighter Sleeve`
- **Category:** Accessories → Keychains & Lanyards / EDC Gear
- **13 Etsy Tags:**
  `bic lighter case, leather lighter, edc lighter sleeve, veg tan keychain, bushcraft leather, hand sewn bic case, keychain lighter, everyday carry gear, brass keyring case, minimalist edc, camp fire sleeve, saddle stitched`

### R-07 — 35mm Single-Piece Leather Belt ($110 / €100)
- **Title (Etsy / Grailed):** `35mm Single Piece Vegetable Tanned Leather Belt R-07 Solid Cast Brass Buckle Selvedge Denim Belt`
- **Category:** Accessories → Belts & Suspenders
- **13 Etsy Tags:**
  `35mm leather belt, solid brass buckle, veg tan belt, single piece strap, selvedge denim belt, heritage work belt, hand made belt, heavy duty belt, natural leather belt, cast brass belt, mens leather belt, raw leather strap`

### Base Layer ASH GREY — 230 GSM Longsleeve ($65 / €60)
- **Title (Etsy / Grailed):** `Heavyweight 230 GSM 100% Cotton Longsleeve T-Shirt Ash Grey Architectural Straight Cut Base Layer`
- **Category:** Clothing → Tops & Tees → Long Sleeve T-Shirts
- **13 Etsy Tags:**
  `230 gsm longsleeve, heavyweight cotton, ash grey tee, architectural shirt, straight cut tee, brutalist clothing, heavy cotton shirt, minimalist apparel, reinforced collar, mens base layer, unisex heavy tee, industrial fashion, studio workwear`

---

## 5. Шпаргалка для отправки СДЭК и Международной почтой (Таможенные коды HS / ТН ВЭД и вес)

При оформлении международной накладной СДЭК или декларации CN22/CN23 используй эти данные. **Коммерческий товар (продажа) обязательно декларировать как Commercial goods / Merchandise с фактической стоимостью продажи — НЕ как `Gift` / `Personal use`:** занижение или неверное указание назначения — это недостоверное декларирование, влечёт конфискацию посылки, штрафы и блокировки у перевозчика. Стоимость в декларации = реальная цена продажи.

| Артикул | Наименование в декларации (EN) | Код ТН ВЭД / HS Code (6 знаков) | Вес нетто / брутто | Габариты упаковки |
|---|---|---|---|---|
| **ch-01 (Объект №04)** | `Handmade Leather Card Holder` | `420231` (оценка, требует подтверждения классификации) | 45 г / 95 г *(оценка — взвесить)* | 14 × 10 × 2 см *(оценка — обмерить)* |
| **ch-09 (Объект №09)** | `Handmade Leather Bifold Card Case` | `420231` (оценка) | 65 г / 115 г *(оценка — взвесить)* | 14 × 10 × 2.5 см *(оценка)* |
| **l-01 (Объект №27)** | `Leather Keyring Sleeve (Empty, No Lighter)` *(Важно: отправлять БЕЗ газовой зажигалки внутри! Газ запрещён к авиапересылке)* | `420500` (оценка) | 30 г / 75 г *(оценка — взвесить)* | 12 × 8 × 2 см *(оценка)* |
| **s-07 (Ремень R-07)** | `Men's Leather Belt with Brass Buckle` | `420330` (оценка) | 260 г / 340 г *(оценка — взвесить)* | 15 × 15 × 5 см *(оценка)* |
| **tr-01 (ASH GREY)** | `100% Cotton Knitted Longsleeve T-Shirt` | `610910` (оценка; сверить трикотажная ли тканая — от этого зависит код) | 320 г / 390 г *(оценка — взвесить)* | 26 × 20 × 4 см *(оценка)* |

> Все веса, габариты и коды HS/ТН ВЭД выше — неподтверждённые оценки. Перед отправкой: фактическое взвешивание и обмер каждой позиции, коды ТН ВЭД подтвердить по ТН ВЭД ЕАЭС / классификатору (или через запрос перевозчику).

> **Критично по «Объекту №27» (Контейнер для огня):**
> В международную авиапосылку СДЭК/Почты **нельзя класть саму газовую зажигалку BIC** (опасный груз в самолете — развернут на рентгене). В посылку кладется только сам кожаный корпус (а для формовки можно вложить деревянный или пластиковый макет в размер BIC), и в описи писать: **`Leather Keyring Sleeve (Empty)`**.
