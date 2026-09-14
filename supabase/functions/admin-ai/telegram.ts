/**
 * Проверка подписи Telegram Mini App.
 *
 * Зачем: сейчас заказ принимает telegram_id из тела запроса, то есть любой,
 * кто знает адрес функции, может создать заказ от чужого имени. Telegram
 * подписывает данные мини-приложения ключом бота, и эту подпись можно
 * проверить на сервере — тогда личность покупателя не берётся на слово.
 *
 * Модуль чистый: ни Deno, ни Supabase, ни сети. Криптография — WebCrypto,
 * она есть и в Deno, и в Node, поэтому проверка запускается обычным тестом.
 *
 * Формула Telegram: secret = HMAC_SHA256(key="WebAppData", message=bot_token),
 * затем hash = HMAC_SHA256(key=secret, message=data_check_string), где
 * data_check_string — все поля кроме hash, отсортированные по имени.
 */

export type InitDataReject =
  | 'INIT_DATA_MISSING'
  | 'INIT_DATA_MALFORMED'
  | 'INIT_DATA_BAD_HASH'
  | 'INIT_DATA_EXPIRED'
  | 'INIT_DATA_NO_USER';

export type InitDataResult =
  | { ok: true; user: { id: number; first_name?: string; username?: string }; authDate: number }
  | { ok: false; reason: InitDataReject };

export interface VerifyOptions {
  /** Сколько секунд подпись считается свежей. По умолчанию сутки. */
  maxAgeSeconds?: number;
  /** Текущее время в секундах — для тестов. */
  now?: number;
}

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

const encoder = new TextEncoder();

const hmac = async (key: Uint8Array, message: string): Promise<Uint8Array> => {
  // Ключ передаём собственным буфером: типы различают ArrayBuffer и
  // SharedArrayBuffer, и Uint8Array целиком под BufferSource не подходит.
  const keyBytes = new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes.buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return new Uint8Array(signature);
};

const toHex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/** Сравнение за постоянное время: иначе подпись подбирается по времени ответа. */
const equalHex = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

/**
 * Проверяет строку initData, которую мини-приложение получило от Telegram.
 * @param initData - строка вида `query_id=...&user=...&auth_date=...&hash=...`.
 * @param botToken - токен бота, которым подписаны данные.
 * @param options - предел свежести подписи и текущее время.
 * @returns покупателя из подписи либо причину отказа.
 */
export const verifyInitData = async (
  initData: unknown,
  botToken: string,
  options: VerifyOptions = {},
): Promise<InitDataResult> => {
  if (typeof initData !== 'string' || initData.trim().length === 0) return { ok: false, reason: 'INIT_DATA_MISSING' };
  if (botToken.trim().length === 0) return { ok: false, reason: 'INIT_DATA_MALFORMED' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, reason: 'INIT_DATA_MALFORMED' };

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash' || key === 'signature') continue;
    pairs.push(`${key}=${value}`);
  }
  if (pairs.length === 0) return { ok: false, reason: 'INIT_DATA_MALFORMED' };
  const checkString = pairs.sort().join('\n');

  const secret = await hmac(encoder.encode('WebAppData'), botToken);
  const expected = toHex(await hmac(secret, checkString));
  if (!equalHex(expected, hash.toLowerCase())) return { ok: false, reason: 'INIT_DATA_BAD_HASH' };

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: 'INIT_DATA_MALFORMED' };
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  if (now - authDate > maxAge || authDate - now > 60) return { ok: false, reason: 'INIT_DATA_EXPIRED' };

  const rawUser = params.get('user');
  if (!rawUser) return { ok: false, reason: 'INIT_DATA_NO_USER' };
  let user: { id?: unknown; first_name?: unknown; username?: unknown };
  try {
    user = JSON.parse(rawUser) as typeof user;
  } catch {
    return { ok: false, reason: 'INIT_DATA_MALFORMED' };
  }
  if (typeof user.id !== 'number' || !Number.isFinite(user.id) || user.id <= 0) {
    return { ok: false, reason: 'INIT_DATA_NO_USER' };
  }

  return {
    ok: true,
    authDate,
    user: {
      id: user.id,
      ...(typeof user.first_name === 'string' ? { first_name: user.first_name } : {}),
      ...(typeof user.username === 'string' ? { username: user.username } : {}),
    },
  };
};

/** Подписывает данные так, как это делает Telegram: только для тестов и проб. */
export const signInitData = async (
  fields: Record<string, string>,
  botToken: string,
): Promise<string> => {
  const pairs = Object.entries(fields).map(([key, value]) => `${key}=${value}`).sort();
  const secret = await hmac(encoder.encode('WebAppData'), botToken);
  const hash = toHex(await hmac(secret, pairs.join('\n')));
  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
};
