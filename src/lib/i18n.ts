import { Product } from '@/types';

export type Lang = 'ru' | 'en';
export type Currency = 'RUB' | 'USD' | 'EUR';

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
};

/**
 * Официальные криптокошельки ателье (из раздела «Поддержка» в Footer).
 * Используются для прямой оплаты в криптовалюте на международном и российском чекауте,
 * если в переменных окружения сервера не заданы другие.
 */
export const CRYPTO_WALLETS = [
  { network: 'SOL (Solana / USDC / USDT)', label: 'Solana', address: '4QoVmYDgTAH99PVWT13e77FXnWxdSUkhd42bakeJ7zBA' },
  { network: 'TON (Toncoin / USDT TON)', label: 'Ton', address: 'UQCPCI52jq76GTKAZq0HHxMalghb6A_SRVJxSdU0LXpyfat7' },
] as const;

/**
 * Мультивалютная и мультиязычная матрица для каждого изделия по его id.
 * Источник русского текста и базовой цены в рублях — `src/constants.ts`.
 * Тексты на английском сохраняют голос владельца: утверждение вместе с причиной,
 * видимая механика вещи, отсутствие маркетингового восторга.
 */
export type ProductLocale = {
  price: Record<Currency, number>;
  en: {
    name: string;
    description: string;
    features: string[];
    sizes?: string[];
  };
};

export const PRODUCT_I18N: Record<string, ProductLocale> = {
  'ch-01': {
    price: { RUB: 4900, USD: 65, EUR: 60 },
    en: {
      name: 'Card Container. Object #04',
      description:
        'Two compartments. Built strictly for two cards — not for "everything at once".\n' +
        'Vegetable-tanned leather: bark tannins instead of chromium. Breathable, no chemical odor, darkens and ages with use.\n' +
        'Hand-sewn with waxed thread, burnished edges: no glue or lining needed, the single piece holds the structure.\n' +
        'Saint Petersburg. Two pieces in stock, further pieces made to order or by drop.',
      features: ['Vegetable-tanned', 'Hand-stitched', 'Two compartments'],
    },
  },
  'ch-09': {
    price: { RUB: 6400, USD: 85, EUR: 80 },
    en: {
      name: 'Double Card Container. Object #09',
      description:
        'Bifold architecture: two opposing compartments instead of one, cards lie flat rather than stacked.\n' +
        'Vegetable-tanned leather: bark tannins instead of chromium. Breathable, no chemical odor, darkens and ages with use.\n' +
        'Hand-sewn with waxed thread, burnished edges: no glue or lining needed, the single piece holds the structure.\n' +
        'Saint Petersburg. Two pieces in stock, further pieces made to order or by drop.',
      features: ['Vegetable-tanned', 'Hand-stitched', 'Bifold layout'],
    },
  },
  'l-01': {
    price: { RUB: 2400, USD: 35, EUR: 32 },
    en: {
      name: 'Fire Container. Object #27',
      description:
        'Body molded for a standard full-size BIC lighter. Not "universal" — built to exact tolerance so the lighter sits tight.\n' +
        'Vegetable-tanned leather, hand saddle-stitched. Darkens and ages over time — the shell outlives the disposable core.\n' +
        'Keyring attachment. Two pieces in stock, further pieces made to order or by drop.',
      features: ['Full-grain leather', 'Hand-stitched', 'Fits original BIC'],
    },
  },
  's-07': {
    price: { RUB: 6900, USD: 110, EUR: 100 },
    en: {
      name: '35mm Leather Belt R-07',
      description:
        'Single-piece full-grain leather strap, 35 mm (1.38") wide. Not laminated from layers: uniform thickness along the entire length prevents splitting at the bend.\n' +
        'Vegetable-tanned with bark and leaf tannins instead of chromium: breathable, darkens and ages with wear. Solid cast brass buckle.\n' +
        'Sized by denim waist W: S — W30–W31 (76–79 cm / 30–31"), M — W32–W33 (81–84 cm / 32–33"), L — W34–W36 (86–91 cm / 34–36"), XL — W38–W40 (96–102 cm / 38–40").\n' +
        'Two pieces in stock, further pieces made to order or by drop.',
      features: ['Single-piece leather', '35 mm / 1.38" width', 'Solid cast brass buckle'],
    },
  },
  'tr-01': {
    price: { RUB: 3900, USD: 65, EUR: 60 },
    en: {
      name: 'Base Layer ASH GREY',
      description:
        'Heavyweight 230 gsm 100% cotton. The density is stated because it defines how the garment holds its geometry and how long it survives.\n' +
        'Reinforced collar rib retains tension after washes. Straight cut: does not pull, does not cling, requires no tailoring.\n' +
        'Sizes M, L, XL. Two pieces in stock, further pieces made to order or by drop.',
      features: ['100% Cotton', '230 GSM'],
    },
  },
};

export const getProductName = (product: Product, lang: Lang): string =>
  lang === 'en' ? (PRODUCT_I18N[product.id]?.en.name ?? product.name) : product.name;

export const getProductDescription = (product: Product, lang: Lang): string =>
  lang === 'en' ? (PRODUCT_I18N[product.id]?.en.description ?? product.description) : product.description;

export const getProductFeatures = (product: Product, lang: Lang): string[] =>
  lang === 'en' ? (PRODUCT_I18N[product.id]?.en.features ?? product.features) : product.features;

export const getProductPrice = (product: Product, currency: Currency): number => {
  if (currency === 'RUB') return product.price;
  const mapped = PRODUCT_I18N[product.id]?.price[currency];
  if (mapped) return mapped;
  // Фолбэк для новых товаров из базы
  return currency === 'USD' ? Math.ceil(product.price / 75) : Math.ceil(product.price / 82);
};

export const formatMoney = (amount: number, currency: Currency): string => {
  if (currency === 'RUB') return `${amount}₽`;
  if (currency === 'USD') return `$${amount}`;
  return `€${amount}`;
};

/** Международная доставка СДЭК Global / Авиа (в валюте заказа; от $120 / €110 бесплатно). */
export const getInternationalShipping = (subtotal: number, currency: Currency, isInternational: boolean): number => {
  // Ноль здесь означает «не включена», а не бесплатную доставку.
  // Страну, доступность маршрута и тариф согласовываем до оплаты.
  return 0;
};

export const UI_TEXT = {
  ru: {
    brandName: 'ТАК И РАТ',
    brandSubtitle: 'РУЧНАЯ РАБОТА. НАТУРАЛЬНАЯ КОЖА И ХЛОПОК. МИНИМАЛИЗМ И ДОЛГОВЕЧНОСТЬ.',
    heroBadge: 'РОССИЙСКОЕ ПРЕМИАЛЬНОЕ РЕМЕСЛО',
    heroRow1Label: 'Направление',
    heroRow1Value: 'Ателье Кожи и Текстиля',
    heroRow2Label: 'Материал',
    heroRow2Value: 'Хлопок 100% / Нат. Кожа',
    heroRow3Label: 'Логистика',
    heroRow3Value: 'СДЭК (РФ и Мир) / Yandex / Почта',
    filterAll: 'ВСЕ',
    filterApparel: 'ОДЕЖДА',
    filterGear: 'СНАРЯЖЕНИЕ',
    badgeApparel: 'ОДЕЖДА',
    badgeGear: 'СНАРЯЖЕНИЕ',
    badgeLeather: 'КОЖА',
    badgeCotton: '230 Г/М²',
    skuPrefix: 'АРТ.',
    addToCart: 'В КОРЗИНУ',
    oneSize: 'ЕДИНЫЙ РАЗМЕР',
    noPhoto: 'НЕТ ФОТО',
    warmingUp: 'РАЗОГРЕВ СИСТЕМЫ...',
    scanning: 'СКАНИРОВАНИЕ ИНВЕНТАРЯ...',
    conceptTitle: 'ЭКИПИРОВКА ДЛЯ ЭПОХИ НЕОПРЕДЕЛЕННОСТИ',
    conceptItems: [
      {
        title: 'АВТОНОМНОСТЬ',
        text: 'МЫ СОЗДАЕМ ИНСТРУМЕНТЫ, КОТОРЫЕ НЕ ТРЕБУЮТ ЗАМЕНЫ КАЖДЫЙ СЕЗОН. ВЕЩИ, КОТОРЫЕ СТАНОВЯТСЯ ВАШЕЙ ЧАСТЬЮ.',
      },
      {
        title: 'МАТЕРИАЛ',
        text: 'ТОЛЬКО НАТУРАЛЬНАЯ КОЖА РАСТИТЕЛЬНОГО ДУБЛЕНИЯ И ПЛОТНЫЙ ХЛОПОК. ТАКТИЛЬНЫЙ КОНТАКТ С РЕАЛЬНОСТЬЮ.',
      },
      {
        title: 'РУЧНОЙ ТРУД',
        text: 'КАЖДЫЙ ШОВ СДЕЛАН ВРУЧНУЮ В САНКТ-ПЕТЕРБУРГЕ. НИКАКОГО МАСС-МАРКЕТА, ТОЛЬКО ОГРАНИЧЕННЫЕ ТИРАЖИ.',
      },
    ],
    philosophyTitle: 'ФИЛОСОФИЯ САМООБЕСПЕЧЕНИЯ.',
    philosophyBody: 'МЫ СОЗДАЕМ ВЕЩИ ДЛЯ ТЕХ, КТО ПРИВЫК ПОЛАГАТЬСЯ НА СЕБЯ. КАЖДЫЙ ПРЕДМЕТ — ЭТО ВАШ ЛИЧНЫЙ АКТ АВТОНОМНОСТИ В ЦИФРОВОМ ХАОСЕ.',
    protocolActive: 'протокол_активен',
    cartTitle: 'Корзина',
    cartEmpty: 'Корзина пуста',
    sizeLabel: 'Размер',
    removeBtn: 'Удалить',
    totalLabel: 'Итого:',
    checkoutBtn: 'Оформить заказ',
    checkoutTitle: 'Оформление заказа',
    addressPlaceholder: 'Адрес ПВЗ (Яндекс / Ozon / СДЭК) или международный адрес',
    payTotalLabel: 'К оплате:',
    shippingLabel: 'Международная доставка (CDEK / Авиа):',
    freeShipping: 'БЕСПЛАТНО',
    paymentHeader: 'ОПЛАТА ПЕРЕВОДОМ',
    cardLabel: 'КАРТА',
    cardNotSet: 'РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ — В TELEGRAM',
    recipientLabel: 'Получатель',
    cryptoWalletsTitle: 'КРИПТОКОШЕЛЬКИ НАПРЯМУЮ (БЕЗ ПОСРЕДНИКОВ):',
    copyBtn: 'КОПИРОВАТЬ',
    copiedBtn: 'СКОПИРОВАНО',
    checkoutNote: 'Перед оплатой согласуйте наличие, доставку и реквизиты с Алексеем в Telegram. После оплаты пришлите подтверждение в чат.',
    orderSentTitle: 'ЗАКАЗ УШЁЛ МАСТЕРУ',
    orderDraftTitle: 'ЗАКАЗ СОБРАН',
    orderSentDesc: 'Мастер получил заказ в Telegram и ответит с подтверждением наличия и реквизитами.',
    orderDraftDesc: 'Откройте чат с ботом — текст заказа уже набран. Нажмите «отправить» в Telegram, и заказ придёт мастеру.',
    openBotBtn: 'ОТКРЫТЬ ЧАТ С БОТОМ',
    backToShopBtn: 'ВЕРНУТЬСЯ В МАГАЗИН',
    orderSubmittedBtn: 'ЗАКАЗ ОТПРАВЛЕН',
    submittingBtn: 'ОТПРАВКА...',
    confirmOrderBtn: 'ПОДТВЕРДИТЬ ЗАКАЗ',
    b2bNav: 'B2B / МЕРЧ',
  },
  en: {
    brandName: 'TAK & RAT',
    brandSubtitle: 'HAND-STITCHED. VEGETABLE-TANNED LEATHER & HEAVYWEIGHT COTTON. ANALOG CONTROL.',
    heroBadge: 'AUTONOMOUS CRAFT ATELIER // SAINT PETERSBURG',
    heroRow1Label: 'Discipline',
    heroRow1Value: 'Leather & Heavyweight Textile Atelier',
    heroRow2Label: 'Material',
    heroRow2Value: '230 GSM Cotton / Full-Grain Veg-Tan Leather',
    heroRow3Label: 'Worldwide Logistics',
    heroRow3Value: 'CDEK — availability and quote confirmed before payment',
    filterAll: 'ALL OBJECTS',
    filterApparel: 'APPAREL',
    filterGear: 'EQUIPMENT',
    badgeApparel: 'APPAREL',
    badgeGear: 'EQUIPMENT',
    badgeLeather: 'VEG-TAN LEATHER',
    badgeCotton: '230 GSM',
    skuPrefix: 'OBJ.',
    addToCart: 'ADD TO CART',
    oneSize: 'ONE SIZE',
    noPhoto: 'NO PHOTO',
    warmingUp: 'WARMING UP SYSTEM...',
    scanning: 'SCANNING INVENTORY...',
    conceptTitle: 'EQUIPMENT FOR AN ERA OF UNCERTAINTY',
    conceptItems: [
      {
        title: 'AUTONOMY',
        text: 'WE BUILD TOOLS THAT DO NOT REQUIRE REPLACEMENT EVERY SEASON. OBJECTS THAT AGE WITH THEIR OWNER.',
      },
      {
        title: 'MATERIAL',
        text: 'STRICTLY FULL-GRAIN VEGETABLE-TANNED LEATHER AND 230 GSM COTTON. TACTILE CONTACT WITH REALITY.',
      },
      {
        title: 'HANDCRAFT',
        text: 'EVERY SADDLE STITCH IS SEWN BY HAND IN SAINT PETERSBURG. NO MASS PRODUCTION — LIMITED BATCHES ONLY.',
      },
    ],
    philosophyTitle: 'PHILOSOPHY OF SELF-RELIANCE.',
    philosophyBody: 'BUILT FOR THOSE WHO RELY ON THEMSELVES. EVERY OBJECT IS AN ACT OF ANALOG CONTROL IN DIGITAL CHAOS.',
    protocolActive: 'protocol_active',
    cartTitle: 'Cart',
    cartEmpty: 'Your cart is empty',
    sizeLabel: 'Size',
    removeBtn: 'Remove',
    totalLabel: 'Subtotal:',
    checkoutBtn: 'Proceed to Checkout',
    checkoutTitle: 'International & Local Checkout',
    addressPlaceholder: 'Country, City, Street Address, Postal Code & Phone (CDEK / Worldwide Tracked)',
    payTotalLabel: 'Total Due:',
    shippingLabel: 'Worldwide Tracked Shipping (CDEK / Air):',
    freeShipping: 'QUOTED SEPARATELY BEFORE PAYMENT',
    paymentHeader: 'DIRECT CRYPTO & INTERNATIONAL PAYMENT',
    cardLabel: 'CARD',
    cardNotSet: 'PAYMENT OPTIONS AND SHIPPING MUST BE CONFIRMED WITH ALEXEY BEFORE PAYMENT',
    recipientLabel: 'Recipient',
    cryptoWalletsTitle: 'DIRECT ATELIER WALLETS (0% MIDDLEMAN FEE):',
    copyBtn: 'COPY',
    copiedBtn: 'COPIED',
    checkoutNote: 'Do not send funds yet. Confirm stock, destination, shipping cost, available lawful payment method, exact asset and network with Alexey first. Wallet addresses alone do not confirm token acceptance.',
    orderSentTitle: 'ORDER TRANSMITTED TO ATELIER',
    orderDraftTitle: 'ORDER PREPARED',
    orderSentDesc: 'Alexey received your order in Telegram and will reply with tracking & payment confirmation.',
    orderDraftDesc: 'Open the Telegram bot — your order summary is pre-filled. Press Send in Telegram to transmit directly to the maker.',
    openBotBtn: 'OPEN TELEGRAM BOT',
    backToShopBtn: 'RETURN TO CATALOG',
    orderSubmittedBtn: 'ORDER SENT',
    submittingBtn: 'TRANSMITTING...',
    confirmOrderBtn: 'CONFIRM ORDER',
    b2bNav: 'B2B / MERCH',
  },
} as const;
