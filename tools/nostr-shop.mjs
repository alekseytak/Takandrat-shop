#!/usr/bin/env node
/**
 * Магазин «ТАК И РАТ» (TAK & RAT) в децентрализованной сети Nostr / Shopstr (NIP-01, NIP-15, NIP-99).
 *
 * Зачем: на Shopstr.store и Plebeian Market товары продаются напрямую за крипту
 * (BTC / Lightning / USDT / SOL / TON) без паспорта, без банковского счёта и без
 * риска блокировки по стране. Аккаунт — это криптографическая пара ключей
 * secp256k1 (Schnorr BIP-340), которая генерируется локально и принадлежит
 * только владельцу.
 *
 * Ключи хранятся в `~/.takandrat/nostr.json` с правами 600 (в репозиторий не попадают).
 *
 * Команды:
 *   node tools/nostr-shop.mjs init       создать (или показать существующий) аккаунт Nostr (nsec / npub)
 *   node tools/nostr-shop.mjs status     показать публичный ключ npub и статус аккаунта
 *   node tools/nostr-shop.mjs export     собрать подписанные события профиля и 5 товаров в content/international/nostr-events.json
 *   node tools/nostr-shop.mjs publish    опубликовать профиль и 5 карточек товаров в публичные релеи Nostr / Shopstr
 */

import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const CONFIG_PATH = process.env.NOSTR_CONFIG || join(homedir(), '.takandrat', 'nostr.json');
const EXPORT_PATH = resolve('content/international/nostr-events.json');
const SHOP_BASE_URL = 'https://takandrat-shop.vercel.app';

// ── Поле secp256k1 и BIP-340 Schnorr (чистый BigInt, 0 внешних зависимостей) ──
const P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;

const mod = (a, m = P) => ((a % m) + m) % m;

const modPow = (base, exp, m = P) => {
  let res = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) res = (res * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return res;
};

const modInv = (a, m = P) => modPow(a, m - 2n, m);

const pointAdd = (p1, p2) => {
  if (!p1) return p2;
  if (!p2) return p1;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  if (x1 === x2 && y1 !== y2) return null;
  const lam = x1 === x2
    ? mod(3n * x1 * x1 * modInv(2n * y1))
    : mod((y2 - y1) * modInv(x2 - x1));
  const x3 = mod(lam * lam - x1 - x2);
  const y3 = mod(lam * (x1 - x3) - y1);
  return [x3, y3];
};

const pointMul = (k, point = [GX, GY]) => {
  let res = null;
  let addend = point;
  let scalar = k;
  while (scalar > 0n) {
    if (scalar & 1n) res = pointAdd(res, addend);
    addend = pointAdd(addend, addend);
    scalar >>= 1n;
  }
  return res;
};

const numTo32Bytes = (num) => Buffer.from(num.toString(16).padStart(64, '0'), 'hex');
const bytesToNum = (buf) => BigInt('0x' + Buffer.from(buf).toString('hex'));

const taggedHash = (tag, msg) => {
  const tagHash = createHash('sha256').update(tag, 'utf8').digest();
  return createHash('sha256').update(Buffer.concat([tagHash, tagHash, Buffer.from(msg)])).digest();
};

const getPublicKeyHex = (privHex) => {
  const d = BigInt('0x' + privHex);
  const [px] = pointMul(d);
  return numTo32Bytes(px).toString('hex');
};

const schnorrSign = (msgHex, privHex) => {
  const d0 = BigInt('0x' + privHex);
  const PPoint = pointMul(d0);
  const d = (PPoint[1] & 1n) === 0n ? d0 : N - d0;
  const pxBytes = numTo32Bytes(PPoint[0]);
  const msgBytes = Buffer.from(msgHex, 'hex');
  const aux = randomBytes(32);
  const t = bytesToNum(taggedHash('BIP0340/aux', aux)) ^ d;
  const rand = taggedHash('BIP0340/nonce', Buffer.concat([numTo32Bytes(t), pxBytes, msgBytes]));
  const k0 = mod(bytesToNum(rand), N);
  if (k0 === 0n) throw new Error('Schnorr nonce k0 is zero');
  const R = pointMul(k0);
  const k = (R[1] & 1n) === 0n ? k0 : N - k0;
  const rxBytes = numTo32Bytes(R[0]);
  const eHash = taggedHash('BIP0340/challenge', Buffer.concat([rxBytes, pxBytes, msgBytes]));
  const e = mod(bytesToNum(eHash), N);
  const s = mod(k + e * d, N);
  return Buffer.concat([rxBytes, numTo32Bytes(s)]).toString('hex');
};

// ── Bech32 (NIP-19: npub1... и nsec1...) ──────────────────────────────────────
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const polymod = (values) => {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
  }
  return chk;
};

const convertBits = (data, fromBits, toBits, pad = true) => {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  return ret;
};

const bech32Encode = (hrp, hexData) => {
  const words = convertBits(Buffer.from(hexData, 'hex'), 8, 5, true);
  const hrpExpanded = [
    ... [...hrp].map((c) => c.charCodeAt(0) >> 5),
    0,
    ... [...hrp].map((c) => c.charCodeAt(0) & 31),
  ];
  const modVal = polymod([...hrpExpanded, ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = [];
  for (let p = 0; p < 6; p++) checksum.push((modVal >> (5 * (5 - p))) & 31);
  return `${hrp}1${[...words, ...checksum].map((d) => CHARSET[d]).join('')}`;
};

// ── Подпись события NIP-01 ────────────────────────────────────────────────────
const signEvent = ({ kind, created_at, tags, content }, privHex, pubkey) => {
  const serialized = JSON.stringify([0, pubkey, created_at, kind, tags, content]);
  const id = createHash('sha256').update(serialized, 'utf8').digest('hex');
  const sig = schnorrSign(id, privHex);
  return { id, pubkey, created_at, kind, tags, content, sig };
};

// ── Товары для Nostr / Shopstr (NIP-99 kind 30402 Classified Listing) ────────
const SHOPSTR_ITEMS = [
  {
    d: 'takandrat-ch-01-object-04',
    title: 'Card Container. Object #04 — Hand-Stitched Veg-Tan Leather',
    summary: 'Two compartments for two cards. Vegetable-tanned leather (bark tannins, no chromium), hand saddle-stitched with waxed thread.',
    priceUsd: '65',
    image: `${SHOP_BASE_URL}/products/web/01.webp`,
    images: [`${SHOP_BASE_URL}/products/web/01.webp`, `${SHOP_BASE_URL}/products/web/02.webp`, `${SHOP_BASE_URL}/products/web/03.webp`],
    tags: ['edc', 'leather', 'wallet', 'cardholder', 'handcrafted', 'shopstr'],
    description: [
      'Two compartments. Built strictly for two cards — not for "everything at once".',
      'Vegetable-tanned leather: bark tannins instead of chromium. Breathable, no chemical odor, darkens and ages with use.',
      'Hand-sewn with waxed thread, burnished edges: no glue or lining needed, the single piece holds the structure.',
      'Crafted in Saint Petersburg by Alexey (TAK & RAT Atelier).',
      'Direct Crypto Checkout (SOL / TON / USDT) & Worldwide Tracked Shipping:',
      `${SHOP_BASE_URL}/?lang=en&currency=usd`,
    ].join('\n\n'),
  },
  {
    d: 'takandrat-ch-09-object-09',
    title: 'Double Card Container. Object #09 — Bifold Veg-Tan Leather',
    summary: 'Bifold card container: two opposing compartments so cards lie flat rather than stacked. Hand-stitched vegetable-tanned leather.',
    priceUsd: '85',
    image: `${SHOP_BASE_URL}/products/web/18.webp`,
    images: [`${SHOP_BASE_URL}/products/web/18.webp`, `${SHOP_BASE_URL}/products/web/19.webp`, `${SHOP_BASE_URL}/products/web/20.webp`],
    tags: ['edc', 'leather', 'bifold', 'wallet', 'handcrafted', 'shopstr'],
    description: [
      'Bifold architecture: two opposing compartments instead of one, cards lie flat rather than stacked.',
      'Vegetable-tanned leather: bark tannins instead of chromium. Breathable, no chemical odor, darkens and ages with use.',
      'Hand-sewn with waxed thread, burnished edges: no glue or lining needed, the single piece holds the structure.',
      'Crafted in Saint Petersburg by Alexey (TAK & RAT Atelier).',
      'Direct Crypto Checkout (SOL / TON / USDT) & Worldwide Tracked Shipping:',
      `${SHOP_BASE_URL}/?lang=en&currency=usd`,
    ].join('\n\n'),
  },
  {
    d: 'takandrat-l-01-object-27',
    title: 'Fire Container (BIC Case). Object #27 — Veg-Tan Leather EDC',
    summary: 'Precision-molded vegetable-tanned leather sleeve for a full-size BIC lighter with keyring loop. Hand saddle-stitched.',
    priceUsd: '35',
    image: `${SHOP_BASE_URL}/products/web/06.webp`,
    images: [`${SHOP_BASE_URL}/products/web/06.webp`, `${SHOP_BASE_URL}/products/web/34.webp`, `${SHOP_BASE_URL}/products/web/35.webp`],
    tags: ['edc', 'lighter', 'bic', 'leather', 'bushcraft', 'shopstr'],
    description: [
      'Body molded for a standard full-size BIC lighter. Not "universal" — built to exact tolerance so the lighter sits tight.',
      'Vegetable-tanned leather, hand saddle-stitched. Darkens and ages over time — the shell outlives the disposable core.',
      'Keyring attachment. Crafted in Saint Petersburg by Alexey (TAK & RAT Atelier).',
      'Direct Crypto Checkout (SOL / TON / USDT) & Worldwide Tracked Shipping:',
      `${SHOP_BASE_URL}/?lang=en&currency=usd`,
    ].join('\n\n'),
  },
  {
    d: 'takandrat-s-07-belt-r07',
    title: '35mm Single-Piece Full-Grain Leather Belt R-07 + Solid Brass Buckle',
    summary: 'Single-piece 35mm (1.38") vegetable-tanned strap with solid cast brass buckle. Sized by denim waist W30–W40.',
    priceUsd: '110',
    image: `${SHOP_BASE_URL}/products/web/07.webp`,
    images: [`${SHOP_BASE_URL}/products/web/07.webp`],
    tags: ['belt', 'leather', 'denim', 'brass', 'heritage', 'shopstr'],
    description: [
      'Single-piece full-grain leather strap, 35 mm (1.38") wide. Not laminated from layers: uniform thickness along the entire length prevents splitting at the bend.',
      'Vegetable-tanned with bark and leaf tannins instead of chromium. Solid cast brass buckle.',
      'Sized by denim waist W: S — W30–W31 (76–79 cm), M — W32–W33 (81–84 cm), L — W34–W36 (86–91 cm), XL — W38–W40 (96–102 cm).',
      'Direct Crypto Checkout (SOL / TON / USDT) & Worldwide Tracked Shipping:',
      `${SHOP_BASE_URL}/?lang=en&currency=usd`,
    ].join('\n\n'),
  },
  {
    d: 'takandrat-tr-01-ash-grey',
    title: 'Heavyweight Base Layer ASH GREY — 230 GSM 100% Cotton Longsleeve',
    summary: 'Heavyweight 230 gsm 100% cotton longsleeve. Reinforced collar rib, straight architectural cut. Sizes M, L, XL.',
    priceUsd: '65',
    image: `${SHOP_BASE_URL}/products/web/08.webp`,
    images: [`${SHOP_BASE_URL}/products/web/08.webp`, `${SHOP_BASE_URL}/products/web/25.webp`, `${SHOP_BASE_URL}/products/web/26.webp`],
    tags: ['apparel', 'heavyweight', 'cotton', 'longsleeve', 'streetwear', 'shopstr'],
    description: [
      'Heavyweight 230 gsm 100% cotton. The density is stated because it defines how the garment holds its geometry and how long it survives.',
      'Reinforced collar rib retains tension after washes. Straight cut: does not pull, does not cling, requires no tailoring.',
      'Sizes M, L, XL. Crafted in Saint Petersburg by TAK & RAT Atelier.',
      'Direct Crypto Checkout (SOL / TON / USDT) & Worldwide Tracked Shipping:',
      `${SHOP_BASE_URL}/?lang=en&currency=usd`,
    ].join('\n\n'),
  },
];

const ensureAccount = () => {
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  }
  const privHex = randomBytes(32).toString('hex');
  const pubHex = getPublicKeyHex(privHex);
  const nsec = bech32Encode('nsec', privHex);
  const npub = bech32Encode('npub', pubHex);
  const account = {
    name: 'TAK & RAT Atelier',
    privHex,
    pubHex,
    nsec,
    npub,
    createdAt: new Date().toISOString(),
    shopstrProfileUrl: `https://shopstr.store/marketplace/${npub}`,
    njumpUrl: `https://njump.me/${npub}`,
  };
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 });
  chmodSync(CONFIG_PATH, 0o600);
  return account;
};

const buildEvents = (account) => {
  const now = Math.floor(Date.now() / 1000);
  const profileContent = JSON.stringify({
    name: 'takandrat',
    display_name: 'TAK & RAT // Leather & Textile Atelier',
    about: 'Equipment for an era of uncertainty. Hand-stitched vegetable-tanned leather & 230 gsm heavyweight cotton. Analog control. Direct SOL / TON / USDT checkout & worldwide shipping.',
    website: `${SHOP_BASE_URL}/?lang=en&currency=usd`,
    picture: `${SHOP_BASE_URL}/products/web/01.webp`,
    banner: `${SHOP_BASE_URL}/products/web/18.webp`,
  });

  const profileEvent = signEvent(
    { kind: 0, created_at: now, tags: [], content: profileContent },
    account.privHex,
    account.pubHex,
  );

  const listingEvents = SHOPSTR_ITEMS.map((item, idx) =>
    signEvent(
      {
        kind: 30402,
        created_at: now + idx + 1,
        tags: [
          ['d', item.d],
          ['title', item.title],
          ['summary', item.summary],
          ['price', item.priceUsd, 'USD'],
          ['location', 'Saint Petersburg / Worldwide Shipping'],
          ['status', 'active'],
          ...item.images.map((img) => ['image', img]),
          ...item.tags.map((t) => ['t', t]),
        ],
        content: item.description,
      },
      account.privHex,
      account.pubHex,
    ),
  );

  return { profileEvent, listingEvents };
};

const publishToRelay = (relayUrl, events, timeoutMs = 8000) =>
  new Promise((resolvePromise) => {
    let settled = false;
    let accepted = 0;
    const done = (result) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      resolvePromise(result);
    };
    const timer = setTimeout(() => done({ relay: relayUrl, ok: accepted > 0, accepted, note: 'timeout' }), timeoutMs);
    let ws;
    try {
      ws = new WebSocket(relayUrl);
    } catch (err) {
      clearTimeout(timer);
      return done({ relay: relayUrl, ok: false, accepted: 0, note: err.message });
    }
    ws.onopen = () => {
      for (const ev of events) {
        ws.send(JSON.stringify(['EVENT', ev]));
      }
    };
    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(String(msg.data));
        if (parsed[0] === 'OK' && parsed[2] === true) {
          accepted += 1;
          if (accepted >= events.length) {
            clearTimeout(timer);
            done({ relay: relayUrl, ok: true, accepted, note: 'all accepted' });
          }
        }
      } catch {}
    };
    ws.onerror = () => {
      clearTimeout(timer);
      done({ relay: relayUrl, ok: accepted > 0, accepted, note: 'ws error' });
    };
  });

const cmd = process.argv[2] || 'status';
const account = ensureAccount();
const { profileEvent, listingEvents } = buildEvents(account);

mkdirSync(dirname(EXPORT_PATH), { recursive: true });
writeFileSync(
  EXPORT_PATH,
  `${JSON.stringify(
    {
      npub: account.npub,
      pubkey: account.pubHex,
      shopstrMarketplaceUrl: account.shopstrProfileUrl,
      njumpProfileUrl: account.njumpUrl,
      generatedAt: new Date().toISOString(),
      events: [profileEvent, ...listingEvents],
    },
    null,
    2,
  )}\n`,
);

if (cmd === 'init' || cmd === 'status' || cmd === 'export') {
  console.log(`Nostr / Shopstr аккаунт готов:`);
  console.log(`  Публичный ключ (npub): ${account.npub}`);
  console.log(`  Секретный ключ:        сохранён в ${CONFIG_PATH} (права 600)`);
  console.log(`  Витрина Shopstr:       ${account.shopstrProfileUrl}`);
  console.log(`  Профиль Nostr:         ${account.njumpUrl}`);
  console.log(`  Подписанные события:   ${EXPORT_PATH} (1 профиль + ${listingEvents.length} товаров)`);
} else if (cmd === 'publish') {
  const relays = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net',
  ];
  const allEvents = [profileEvent, ...listingEvents];
  console.log(`Публикую профиль и ${listingEvents.length} товаров (${account.npub}) в релеи Nostr...`);
  const results = await Promise.all(relays.map((r) => publishToRelay(r, allEvents)));
  for (const res of results) {
    console.log(`  ${res.ok ? '✓' : '✗'} ${res.relay}: принято ${res.accepted}/${allEvents.length} (${res.note})`);
  }
}
