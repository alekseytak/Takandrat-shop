/**
 * Проверка подписи Telegram. Запуск: node supabase/functions/admin-ai/telegram.test.ts
 *
 * Проверка, которая не умеет падать, бесполезна: здесь есть случаи, где
 * подпись подделана, устарела или её нет вовсе. Если сломать сверку подписи
 * в telegram.ts, эти случаи покраснеют.
 */
import { verifyInitData, signInitData } from './telegram.ts';

const BOT_TOKEN = '123456:TEST-TOKEN-FOR-TESTS-ONLY';
const NOW = 1_700_000_000;

let passed = 0;
let failed = 0;

const check = async (title: string, run: () => Promise<boolean>): Promise<void> => {
  try {
    const ok = await run();
    if (ok) {
      passed += 1;
      console.log(`  ок   ${title}`);
    } else {
      failed += 1;
      console.log(`  ПРОВАЛ ${title}`);
    }
  } catch (error) {
    failed += 1;
    console.log(`  ПРОВАЛ ${title} — ${error instanceof Error ? error.message : String(error)}`);
  }
};

const fresh = { auth_date: String(NOW - 60), query_id: 'AAA', user: JSON.stringify({ id: 42, first_name: 'Толя', username: 'tolya' }) };

console.log('подпись Telegram mini app\n');

await check('правильная подпись принимается', async () => {
  const result = await verifyInitData(await signInitData(fresh, BOT_TOKEN), BOT_TOKEN, { now: NOW });
  return result.ok && result.user.id === 42 && result.user.first_name === 'Толя';
});

await check('подпись связывает именно этого покупателя', async () => {
  const signed = await signInitData(fresh, BOT_TOKEN);
  const tampered = signed.replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":99'));
  const result = await verifyInitData(tampered, BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_BAD_HASH';
});

await check('подделка чужого id через пересборку строки не проходит', async () => {
  const signed = await signInitData(fresh, BOT_TOKEN);
  const params = new URLSearchParams(signed);
  params.set('user', JSON.stringify({ id: 99, first_name: 'Вор' }));
  const result = await verifyInitData(params.toString(), BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_BAD_HASH';
});

await check('подпись чужим токеном не проходит', async () => {
  const result = await verifyInitData(await signInitData(fresh, 'другой:токен'), BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_BAD_HASH';
});

await check('устаревшая подпись отклоняется', async () => {
  const old = await signInitData({ ...fresh, auth_date: String(NOW - 3 * 24 * 60 * 60) }, BOT_TOKEN);
  const result = await verifyInitData(old, BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_EXPIRED';
});

await check('подпись из будущего отклоняется', async () => {
  const future = await signInitData({ ...fresh, auth_date: String(NOW + 3600) }, BOT_TOKEN);
  const result = await verifyInitData(future, BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_EXPIRED';
});

await check('свежесть настраивается', async () => {
  const signed = await signInitData({ ...fresh, auth_date: String(NOW - 600) }, BOT_TOKEN);
  const strict = await verifyInitData(signed, BOT_TOKEN, { now: NOW, maxAgeSeconds: 300 });
  const loose = await verifyInitData(signed, BOT_TOKEN, { now: NOW, maxAgeSeconds: 3600 });
  return !strict.ok && strict.reason === 'INIT_DATA_EXPIRED' && loose.ok;
});

await check('пустая строка — отказ', async () => {
  const result = await verifyInitData('', BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_MISSING';
});

await check('не строка — отказ', async () => {
  const result = await verifyInitData({ user: 'подделка' }, BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_MISSING';
});

await check('без hash — отказ', async () => {
  const signed = await signInitData(fresh, BOT_TOKEN);
  const withoutHash = signed.split('&').filter((pair) => !pair.startsWith('hash=')).join('&');
  const result = await verifyInitData(withoutHash, BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_MALFORMED';
});

await check('hash не того вида — отказ', async () => {
  const signed = await signInitData(fresh, BOT_TOKEN);
  const params = new URLSearchParams(signed);
  params.set('hash', 'короткий');
  const result = await verifyInitData(params.toString(), BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_MALFORMED';
});

await check('без покупателя — отказ', async () => {
  const { user, ...noUser } = fresh;
  void user;
  const result = await verifyInitData(await signInitData(noUser, BOT_TOKEN), BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_NO_USER';
});

await check('покупатель не числом — отказ', async () => {
  const result = await verifyInitData(
    await signInitData({ ...fresh, user: JSON.stringify({ id: 'сорок два' }) }, BOT_TOKEN),
    BOT_TOKEN,
    { now: NOW },
  );
  return !result.ok && result.reason === 'INIT_DATA_NO_USER';
});

await check('пустой токен бота — отказ, а не пропуск', async () => {
  const result = await verifyInitData(await signInitData(fresh, BOT_TOKEN), '', { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_MALFORMED';
});

await check('поле signature не мешает проверке', async () => {
  const signed = await signInitData(fresh, BOT_TOKEN);
  const result = await verifyInitData(`${signed}&signature=ed25519-подпись`, BOT_TOKEN, { now: NOW });
  return result.ok && result.user.id === 42;
});

await check('лишние буквы в hash не проходят', async () => {
  const signed = await signInitData(fresh, BOT_TOKEN);
  const params = new URLSearchParams(signed);
  const hash = params.get('hash') ?? '';
  params.set('hash', `${hash.slice(0, 63)}${hash[63] === 'a' ? 'b' : 'a'}`);
  const result = await verifyInitData(params.toString(), BOT_TOKEN, { now: NOW });
  return !result.ok && result.reason === 'INIT_DATA_BAD_HASH';
});

console.log(`\nпройдено: ${passed}, провалено: ${failed}`);
if (failed > 0) process.exit(1);
