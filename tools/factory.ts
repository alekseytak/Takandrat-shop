/**
 * Фабрика контента ТАК И РАТ.
 *
 * Правило, из которого всё следует: изделие снимается настоящее, а модель
 * только правит фон и свет. Придумать товар нельзя, поэтому черновик не
 * сравнивается с исходником «на глазок» одним вопросом. Сначала зрение
 * описывает каждый кадр по списку свойств, потом эти два описания сверяет
 * отдельная модель — и решение принимается по расхождению в свойствах, а не
 * по общему впечатлению.
 *
 * Почему именно так: черновик с выдуманным тиснением, лишним карманом и
 * пропавшей рукой проходил проверку «одним вопросом» со словами «видимые
 * характеристики не изменились». Список свойств такое не пропускает.
 *
 * Запуск:
 *   npx tsx tools/factory.ts list
 *   npx tsx tools/factory.ts describe [товар]    что показывает съёмка
 *   npx tsx tools/factory.ts calibrate           умеет ли проверка говорить «нет»
 *   npx tsx tools/factory.ts photo ch-01         черновик фото товара
 *   npx tsx tools/factory.ts review <папка>      перепроверить черновик
 *   npx tsx tools/factory.ts publish <папка> --approve
 *   npx tsx tools/factory.ts video               доступно ли видео на шлюзе
 *
 * Ключ берётся из ONEPROVIDER_API_KEY, а если её нет — из хранилища харнесса.
 * Ключ нигде не печатается.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { PRODUCTS } from '../src/constants';
import type { Product } from '../src/types';

const BASE = process.env.ONEPROVIDER_BASE_URL || 'https://api.oneprovider.dev/v1';
const IMAGE_MODEL = process.env.FACTORY_IMAGE_MODEL || 'gemini-3.1-flash-image';
const VISION_MODEL = process.env.FACTORY_VISION_MODEL || 'deepseek-v4-flash-vision-exp';
const TEXT_MODEL = process.env.FACTORY_TEXT_MODEL || 'gemini-3.1-flash-lite';
const DRAFTS = resolve('content/drafts');
const CATALOG_DIR = resolve('public/products');
const TMP = '/tmp/factory';

/** Изделие не меняется: разрешён только фон, свет и пылинки. */
const EDIT_PROMPT = [
  'Задача: только фон. Возьми изделие с фотографии ровно как есть и положи его на ровный светло-серый фон (#e8e8e6), мягкий рассеянный свет, тень под изделием.',
  'Запрещено: менять форму, силуэт, цвет и оттенок кожи, швы, прострочку, фурнитуру, тиснение, количество отделений и вырезов; дорисовывать детали, которых нет на фото; убирать детали, которые есть; добавлять текст, логотипы, людей, реквизит.',
  'Разрешено: заменить фон, выровнять освещение, убрать пылинки.',
  'Изделие должно остаться узнаваемо тем же самым предметом.',
].join('\n');

/** Второй наказ: длинный список запретов модель читает хуже, чем простую просьбу. */
const SIMPLE_PROMPT = 'Замени фон на ровный светло-серый студийный. Само изделие оставь без единого изменения: тот же предмет, тот же ракурс, тот же свет на коже, те же швы и фурнитура. Ничего не добавляй и ничего не убирай.';

const PROMPTS: Record<string, string> = { strict: EDIT_PROMPT, simple: SIMPLE_PROMPT };

/** Список свойств: по нему описывается каждый кадр, и по нему же идёт сверка. */
const FIELDS = ['object', 'silhouette', 'color', 'seams', 'hardware', 'embossing', 'compartments', 'background', 'lighting', 'marks_on_image', 'cropped'] as const;
type Field = typeof FIELDS[number];
type Facts = Record<Field, string>;

const FACT_FIELDS_JSON = '{"object":"что это за предмет","silhouette":"форма и пропорции","color":"цвет и оттенок","seams":"швы и прострочка","hardware":"фурнитура: кнопки, молнии, кольца","embossing":"тиснение, логотипы, надписи на изделии","compartments":"отделения, карманы, слоты и их количество","background":"фон","lighting":"свет","marks_on_image":"текст, водяные знаки, логотипы поверх кадра","cropped":"обрезан ли предмет краем кадра"}';

const DESCRIBE_PROMPT = `Опиши фотографию товара. Смотри только на то, что реально видно; если деталь неразличима, так и напиши. Ответь строго JSON без пояснений: ${FACT_FIELDS_JSON}`;

const COMPARE_PROMPT = [
  'Ниже два описания одной и той же вещи: первое — с исходной фотографии, второе — с обработанного черновика для каталога.',
  'Разрешены только различия фона, освещения и случайной пыли. Любое другое различие в самом изделии — брак: форма, силуэт, цвет, швы, прострочка, фурнитура, тиснение, надписи, число отделений и слотов, обрезка краем кадра.',
  'Разные слова и разная подробность — это не различие. Различие — только противоречие об одном и том же свойстве: был чёрный, стал коричневый; фурнитуры не было, появилась; отделений было два, стало три; предмет был целый, стал обрезан.',
  'Значение «неразличимо» противоречит любому другому значению: если на исходнике деталь не видна, а на черновике видна, это различие.',
  'Сравни поле за полем и ответь строго JSON без пояснений:',
  '{"same_object":true|false,"differences":["поле: что было → что стало"],"invented_items":["чего нет на исходнике, но есть на черновике"],"removed_items":["что было на исходнике, но пропало"],"fit_for_catalog":true|false,"confidence":"высокая|средняя|низкая"}',
].join(' ');

type Verdict = {
  same_object: boolean;
  differences: string[];
  invented_items: string[];
  removed_items: string[];
  fit_for_catalog: boolean;
  confidence?: string;
};

type Decision = { status: 'passed' | 'rejected'; reasons: string[] };

const apiKey = (): string => {
  const fromEnv = process.env.ONEPROVIDER_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const credentials = join(homedir(), '.dsh', '.credentials.yaml');
  if (!existsSync(credentials)) throw new Error('нет ONEPROVIDER_API_KEY и нет ~/.dsh/.credentials.yaml');
  const match = readFileSync(credentials, 'utf8').match(/ONEPROVIDER_API_KEY:\s*(\S+)/);
  if (!match) throw new Error('в ~/.dsh/.credentials.yaml нет ONEPROVIDER_API_KEY');
  return match[1];
};

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/**
 * Шлюз отвечает 502 «временно недоступен» и когда действительно занят, и
 * когда запрос слишком тяжёлый. Различить их снаружи нельзя, поэтому тяжёлые
 * запросы мы не отправляем вовсе (см. prepareForVision), а короткие сбои
 * повторяем.
 */
const attempt = async <T>(what: string, tries: number, run: () => Promise<T>): Promise<T> => {
  let last: unknown;
  for (let tryNumber = 1; tryNumber <= tries; tryNumber += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /→ (429|500|502|503|504)|fetch failed|timeout|aborted/i.test(message);
      if (!retryable || tryNumber === tries) break;
      console.log(`  ${what}: попытка ${tryNumber} не удалась (${message.slice(0, 70)}), повторяю`);
      await sleep(2500 * tryNumber);
    }
  }
  throw last;
};

/** Текстовый запрос без картинок: тут подходит обычный chat/completions. */
const chat = async (model: string, text: string, timeoutMs = 180000): Promise<string> => {
  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'user', content: text }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${model} → ${response.status}: ${body.slice(0, 300)}`);
  const data = JSON.parse(body) as { choices?: { message?: { content?: unknown } }[] };
  const answer = data.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || answer.length === 0) throw new Error(`${model} вернул пустой ответ`);
  return answer;
};

/**
 * Генерация картинки. Исходник передаётся здесь же изображением, поэтому это
 * chat/completions: ограничение в 64 КБ относится только к Responses API.
 */
const generate = async (model: string, prompt: string, sourceFile: string, timeoutMs = 300000): Promise<string> => {
  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: asDataUrl(sourceFile) } },
        ],
      }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${model} → ${response.status}: ${body.slice(0, 300)}`);
  const data = JSON.parse(body) as { choices?: { message?: { content?: unknown } }[] };
  const answer = data.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || answer.length === 0) throw new Error(`${model} вернул пустой ответ`);
  return answer;
};

/** Картинку шлюз отдаёт данными внутри markdown-ссылки. */
const pullImage = (answer: string): Buffer => {
  const dataUrl = answer.match(/data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)/);
  if (dataUrl) return Buffer.from(dataUrl[1], 'base64');
  const link = answer.match(/https?:\/\/[^\s")'\\]+\.(?:png|jpe?g|webp)/);
  if (link) throw new Error(`картинка пришла ссылкой, а не данными: ${link[0]}`);
  throw new Error(`в ответе нет картинки: ${answer.slice(0, 200)}`);
};

const asDataUrl = (file: string): string => {
  const data = readFileSync(file);
  const mime = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${data.toString('base64')}`;
};

/**
 * Зрение. Через chat/completions картинки до моделей этого шлюза не доходят:
 * модель отвечает «вы не прикрепили изображение». Работает только Responses
 * API, и только с картинкой, вложенной данными — ссылку шлюз не скачивает.
 */
const vision = async (text: string, file: string, timeoutMs = 180000): Promise<string> => {
  const response = await fetch(`${BASE}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      input: [{ role: 'user', content: [{ type: 'input_text', text }, { type: 'input_image', image_url: asDataUrl(file) }] }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${VISION_MODEL} → ${response.status}: ${body.slice(0, 200)}`);
  const data = JSON.parse(body) as {
    output?: { content?: { type?: string; text?: string }[] }[];
    output_text?: string;
  };
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const part of item.content ?? []) if (part.type === 'output_text' && part.text) parts.push(part.text);
  }
  if (parts.length === 0 && data.output_text) parts.push(data.output_text);
  if (parts.length === 0) throw new Error(`${VISION_MODEL} не сказал ничего о картинке: ${body.slice(0, 200)}`);
  return parts.join('\n');
};

/** Ужимает и переводит в jpeg: в каталоге не нужны png по три мегабайта. */
const exportJpeg = (source: string, target: string, maxSide: number): void => {
  mkdirSync(TMP, { recursive: true });
  execFileSync('/usr/bin/sips', ['-Z', String(maxSide), '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', source, '--out', target], { stdio: 'ignore' });
};

/**
 * Готовит кадр для зрения: не больше 45 КБ и по возможности 800 точек по
 * длинной стороне. Шлюз принимает примерно 64 КБ на запрос, а на маленьком
 * кадре перестают различаться швы и слоты. Поэтому размер подбирается.
 */
const prepareForVision = (file: string, tag: string): string => {
  const target = join(TMP, `vision-${tag}.jpg`);
  for (const side of [800, 720, 640, 560, 480, 400]) {
    exportJpeg(file, target, side);
    if (readFileSync(target).length <= 45 * 1024) return target;
  }
  return target;
};

const imageSize = (file: string): string => {
  const out = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  const width = out.match(/pixelWidth: (\d+)/)?.[1];
  const height = out.match(/pixelHeight: (\d+)/)?.[1];
  return `${width}×${height}, ${Math.round(readFileSync(file).length / 1024)} КБ`;
};

/**
 * Приводит значения к общему виду. Без этого сверка ловит разницу между двумя
 * ответами модели на один и тот же кадр: «швы неразличимы» и «неразличимы» —
 * это одно и то же, а сравнение текстов видит в них расхождение.
 */
const NOT_VISIBLE = /^(не\s*различим|не\s*видн|не\s*виден|не\s*замет|не\s*чита|невозможно|не\s*определ)/i;
const ABSENT = /^(отсутств|нет\b|без\b|не\s*обнаруж|не\s*видно\s*наличия)/i;

const normalizeValue = (value: string): string => {
  const text = value.trim().toLowerCase().replace(/\.$/, '');
  if (NOT_VISIBLE.test(text)) return 'неразличимо';
  if (ABSENT.test(text)) return 'отсутствует';
  return text;
};

const normalize = (facts: Facts): Facts => {
  const out = {} as Facts;
  for (const field of FIELDS) out[field] = normalizeValue(facts[field]);
  return out;
};

const jsonFrom = <T>(answer: string, what: string): T => {
  const match = answer.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`${what}: ответ без JSON — ${answer.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
};

/** Описание кадра по списку свойств. Пустое поле — ошибка, а не «неизвестно». */
const describeFile = async (file: string): Promise<Facts> => {
  const answer = await attempt('описание кадра', 4, () => vision(DESCRIBE_PROMPT, prepareForVision(file, 'describe')));
  const facts = jsonFrom<Partial<Facts>>(answer, 'описание кадра');
  const missing = FIELDS.filter((field) => typeof facts[field] !== 'string' || facts[field]!.trim() === '');
  if (missing.length > 0) throw new Error(`описание кадра не заполнило поля: ${missing.join(', ')}`);
  return facts as Facts;
};

const verify = async (sourceFile: string, draftFile: string): Promise<{ verdict: Verdict; sourceFacts: Facts; draftFacts: Facts }> => {
  const sourceFacts = await describeFile(sourceFile);
  const draftFacts = await describeFile(draftFile);
  const answer = await attempt('сверка описаний', 4, () => chat(
    TEXT_MODEL,
    `${COMPARE_PROMPT}\n\nИсходник:\n${JSON.stringify(normalize(sourceFacts), null, 2)}\n\nЧерновик:\n${JSON.stringify(normalize(draftFacts), null, 2)}`,
  ));
  return { verdict: jsonFrom<Verdict>(answer, 'сверка описаний'), sourceFacts, draftFacts };
};

/**
 * Решение по черновику. Списки расхождений важнее поля same_object: модель
 * охотнее скажет «то же самое», чем признает различие, но выдуманную деталь
 * она всё равно перечислит.
 */
const decide = (verdict: Verdict): Decision => {
  const reasons: string[] = [];
  if (verdict.same_object === false) reasons.push('проверка считает, что это другое изделие');
  for (const item of verdict.differences ?? []) reasons.push(`расхождение — ${item}`);
  for (const item of verdict.invented_items ?? []) reasons.push(`появилось то, чего нет на исходнике: ${item}`);
  for (const item of verdict.removed_items ?? []) reasons.push(`пропало то, что было на исходнике: ${item}`);
  if (verdict.confidence === 'низкая') reasons.push('проверка не уверена в сравнении');
  return { status: reasons.length === 0 ? 'passed' : 'rejected', reasons };
};

const productById = (id: string): Product => {
  const product = PRODUCTS.find((item) => item.id === id);
  if (!product) throw new Error(`нет товара ${id}. Есть: ${PRODUCTS.map((item) => item.id).join(', ')}`);
  return product;
};

const sourcePhoto = (product: Product, wanted?: string): string => {
  const images = product.images ?? [];
  if (images.length === 0) throw new Error(`у товара ${product.id} нет фотографий — снимать нечего`);
  const chosen = wanted ? images.find((image) => image.includes(wanted)) : images[0];
  if (!chosen) throw new Error(`у товара ${product.id} нет фото с «${wanted}». Есть: ${images.join(', ')}`);
  const file = resolve(chosen.replace(/^\//, 'public/'));
  if (!existsSync(file)) throw new Error(`файла нет на диске: ${file}`);
  return file;
};

const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const writeJson = (file: string, data: unknown): void => {
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

const report = (verdict: Verdict, decision: Decision): void => {
  console.log(`  исходник: ${verdict.same_object ? 'то же изделие' : 'ДРУГОЕ ИЗДЕЛИЕ'}, уверенность проверки: ${verdict.confidence ?? '?'}`);
  for (const difference of verdict.differences ?? []) console.log(`  расхождение: ${difference}`);
  for (const item of verdict.invented_items ?? []) console.log(`  придумано: ${item}`);
  for (const item of verdict.removed_items ?? []) console.log(`  пропало: ${item}`);
  console.log(`вердикт: ${decision.status === 'passed' ? 'прошёл' : 'ОТКЛОНЁН'}`);
};

/**
 * Калибровка: проверка обязана уметь сказать «нет». Последний случай —
 * настоящий брак, снятый этой же фабрикой: на нём проверка «одним вопросом»
 * говорила «годится».
 */
const calibrate = async (): Promise<void> => {
  const wallet = sourcePhoto(productById('ch-01'));
  const lighter = sourcePhoto(productById('l-01'));
  // Пережатие в каталожный размер 1500 точек: то же изделие, та же детальность.
  // Сравнивать кадры разной детальности нельзя — на мелком пропадают швы, и
  // сверка честно называет это расхождением. Поэтому сравнение всегда идёт на
  // одинаково подготовленных копиях (см. prepareForVision).
  const resized = join(TMP, 'calibrate-resized.jpg');
  exportJpeg(wallet, resized, 1500);

  const cases: { title: string; source: string; draft: string; expect: 'passed' | 'rejected' }[] = [
    { title: 'исходник против самого себя', source: wallet, draft: wallet, expect: 'passed' },
    { title: 'то же фото, пережатое в каталожный размер', source: wallet, draft: resized, expect: 'passed' },
    { title: 'другой товар', source: wallet, draft: lighter, expect: 'rejected' },
  ];
  const knownBad = '/tmp/oneprovider-probe/strict-gemini-3.1-flash-image.png';
  if (existsSync(knownBad)) {
    cases.push({ title: 'известный брак: выдуманное тиснение, лишний карман, пропавшая рука', source: wallet, draft: knownBad, expect: 'rejected' });
  }

  let failures = 0;
  for (const item of cases) {
    console.log(`\n${item.title} — ждём «${item.expect === 'passed' ? 'прошёл' : 'отклонён'}»`);
    const { verdict } = await verify(item.source, item.draft);
    const decision = decide(verdict);
    report(verdict, decision);
    if (decision.status !== item.expect) {
      failures += 1;
      console.log('  ЭТО НЕВЕРНО');
    }
  }
  console.log();
  console.log(failures === 0 ? 'проверке можно верить' : `проверка ошиблась в ${failures} случаях — верить нельзя`);
  if (failures > 0) process.exitCode = 1;
};

const photo = async (args: string[]): Promise<void> => {
  const productId = args.find((arg) => !arg.startsWith('--'));
  if (!productId) throw new Error('укажите товар: npx tsx tools/factory.ts photo ch-01');
  const wanted = args.find((arg) => arg.startsWith('--image='))?.slice(8);
  const model = args.find((arg) => arg.startsWith('--model='))?.slice(8) || IMAGE_MODEL;
  const promptName = args.find((arg) => arg.startsWith('--prompt='))?.slice(9) || 'strict';
  const prompt = PROMPTS[promptName];
  if (!prompt) throw new Error(`нет наказа «${promptName}». Есть: ${Object.keys(PROMPTS).join(', ')}`);

  const product = productById(productId);
  const source = sourcePhoto(product, wanted);
  const version = stamp();
  const dir = join(DRAFTS, product.id, version);
  mkdirSync(dir, { recursive: true });

  writeJson(join(dir, 'brief.json'), {
    product_id: product.id,
    name: product.name,
    asset_type: 'photo_catalog',
    placement: 'catalog',
    source_files: [source.replace(`${resolve('.')}/`, '')],
    facts: [product.name, `цена ${product.price} ₽`, ...(product.features ?? [])],
    missing_facts: [],
    model,
    prompt_name: promptName,
    prompt,
    created_at: new Date().toISOString(),
  });
  console.log(`товар: ${product.name} (${product.id})`);
  console.log(`исходник: ${source.replace(`${resolve('.')}/`, '')} — ${imageSize(source)}`);
  console.log(`черновик: ${dir.replace(`${resolve('.')}/`, '')}`);

  const started = Date.now();
  const raw = await attempt('генерация картинки', 3, () => generate(model, prompt, source));
  writeFileSync(join(dir, 'draft-raw.png'), pullImage(raw));
  exportJpeg(join(dir, 'draft-raw.png'), join(dir, 'draft.jpg'), 1500);
  console.log(`нарисовано за ${Math.round((Date.now() - started) / 1000)} с: ${imageSize(join(dir, 'draft.jpg'))}`);

  const { verdict, sourceFacts, draftFacts } = await verify(source, join(dir, 'draft.jpg'));
  const decision = decide(verdict);
  writeJson(join(dir, 'facts.json'), { source: sourceFacts, draft: draftFacts });
  writeJson(join(dir, 'verdict.json'), { ...verdict, decision, checked_at: new Date().toISOString() });
  report(verdict, decision);
  if (decision.status === 'rejected') {
    console.log('черновик остаётся в папке как evidence, в каталог не идёт');
    process.exitCode = 1;
  }
};

const review = async (args: string[]): Promise<void> => {
  const dir = args.find((arg) => !arg.startsWith('--'));
  if (!dir) throw new Error('укажите папку черновика');
  const brief = JSON.parse(readFileSync(join(dir, 'brief.json'), 'utf8')) as { source_files: string[] };
  const { verdict, sourceFacts, draftFacts } = await verify(resolve(brief.source_files[0]), join(dir, 'draft.jpg'));
  const decision = decide(verdict);
  writeJson(join(dir, 'facts.json'), { source: sourceFacts, draft: draftFacts });
  writeJson(join(dir, 'verdict.json'), { ...verdict, decision, checked_at: new Date().toISOString() });
  report(verdict, decision);
  if (decision.status === 'rejected') process.exitCode = 1;
};

/** В каталог — только прошедшее проверку и только по явному слову владельца. */
const publish = async (args: string[]): Promise<void> => {
  const dir = args.find((arg) => !arg.startsWith('--'));
  if (!dir) throw new Error('укажите папку черновика');
  if (!args.includes('--approve')) throw new Error('нужно слово владельца: добавьте --approve');
  const verdictFile = join(dir, 'verdict.json');
  if (!existsSync(verdictFile)) throw new Error('сначала проверка: npx tsx tools/factory.ts review <папка>');
  const { decision } = JSON.parse(readFileSync(verdictFile, 'utf8')) as { decision: Decision };
  if (decision.status !== 'passed') throw new Error(`черновик отклонён: ${decision.reasons.join('; ')}`);

  const numbers = readdirSync(CATALOG_DIR)
    .map((name) => Number(name.replace(/\D/g, '')))
    .filter((number) => Number.isFinite(number));
  const next = String(Math.max(0, ...numbers) + 1).padStart(2, '0');
  const target = join(CATALOG_DIR, `${next}.jpg`);
  copyFileSync(join(dir, 'draft.jpg'), target);
  console.log(`в каталоге: public/products/${next}.jpg (${imageSize(target)})`);
  console.log('готовое фото не перезаписывает ни одно прежнее — новый номер, новый файл');
};

const list = (): void => {
  for (const product of PRODUCTS) {
    const photos = (product.images ?? []).map((image) => image.replace('/products/', ''));
    console.log(`${product.id.padEnd(6)} ${product.name.padEnd(28)} ${String(product.price).padStart(5)} ₽  фото: ${photos.join(', ')}`);
  }
};

/** Я не вижу картинок сам, поэтому о состоянии съёмки спрашиваю зрение. */
const describe = async (args: string[]): Promise<void> => {
  const wanted = args.find((arg) => !arg.startsWith('--'));
  const products = wanted ? [productById(wanted)] : PRODUCTS;
  for (const product of products) {
    console.log(`\n${product.name} (${product.id})`);
    for (const image of product.images ?? []) {
      const facts = await describeFile(resolve(image.replace(/^\//, 'public/')));
      console.log(`  ${image}: ${facts.object}`);
      console.log(`      фон: ${facts.background} | поверх кадра: ${facts.marks_on_image} | обрезка: ${facts.cropped}`);
    }
  }
};

const video = async (): Promise<void> => {
  const response = await fetch(`${BASE}/videos/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'grok-imagine-video-1.5', prompt: 'проверка доступности', duration: 4 }),
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  console.log(`шлюз на видео: ${response.status} ${text.slice(0, 200)}`);
  console.log(response.status === 200
    ? 'видео доступно'
    : 'видео этим шлюзом не делается: модели в списке есть, а генерация не настроена. Нужен отдельный сервис.');
};

const commands: Record<string, (args: string[]) => Promise<void> | void> = { calibrate, photo, review, publish, list, describe, video };
const [command, ...rest] = process.argv.slice(2);
const run = commands[command];
if (!run) {
  console.log('команды: list | describe [товар] | calibrate | photo <товар> | review <папка> | publish <папка> --approve | video');
  process.exit(command ? 1 : 0);
}
try {
  await run(rest);
} catch (error) {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
