#!/usr/bin/env node
/**
 * Проба шлюза OneProvider: что он умеет по части фото, видео и голоса.
 *
 * Это не фабрика, а разведка: скрипт задаёт шлюзу по одному вопросу и
 * печатает, что получилось. Нужен, чтобы не строить догадки об API.
 *
 *   node tools/oneprovider-probe.mjs photo   генерация картинки из описания
 *   node tools/oneprovider-probe.mjs retouch обработка настоящего фото товара
 *   node tools/oneprovider-probe.mjs video   попытка видео
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.ONEPROVIDER_BASE_URL || 'https://api.oneprovider.dev/v1';
const OUT = '/tmp/oneprovider-probe';

const apiKey = () => {
  if (process.env.ONEPROVIDER_API_KEY) return process.env.ONEPROVIDER_API_KEY.trim();
  const text = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8');
  const match = text.match(/ONEPROVIDER_API_KEY:\s*(\S+)/);
  if (!match) throw new Error('нет ONEPROVIDER_API_KEY ни в окружении, ни в ~/.dsh/.credentials.yaml');
  return match[1];
};

const post = async (path, body, timeout = 300000) => {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  return { status: response.status, text };
};

/** Достаёт картинку из ответа: шлюз отдаёт её ссылкой data: внутри markdown. */
const pullImage = (text) => {
  const dataUrl = text.match(/data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)/);
  if (dataUrl) return { kind: 'base64', mime: `image/${dataUrl[1]}`, data: Buffer.from(dataUrl[2], 'base64') };
  const link = text.match(/https?:\/\/[^\s")'\\]+\.(?:png|jpe?g|webp)/);
  if (link) return { kind: 'link', url: link[0] };
  return null;
};

const save = (image, name) => {
  mkdirSync(OUT, { recursive: true });
  if (image.kind === 'base64') {
    const ext = image.mime.includes('png') ? 'png' : 'jpg';
    const file = join(OUT, `${name}.${ext}`);
    writeFileSync(file, image.data);
    return `${file} (${Math.round(image.data.length / 1024)} КБ)`;
  }
  return `ссылка: ${image.url}`;
};

const photo = async () => {
  const { status, text } = await post('/chat/completions', {
    model: 'gemini-3.1-flash-image',
    messages: [{
      role: 'user',
      content: 'Каталожное фото: кожаный картхолдер ручной работы, вид сверху, нейтральный светлый фон, мягкий свет, без текста и без людей.',
    }],
  });
  console.log('статус:', status, '| ответ:', Math.round(text.length / 1024), 'КБ');
  const image = pullImage(text);
  console.log(image ? `картинка: ${save(image, 'photo')}` : `картинки нет: ${text.slice(0, 200)}`);
};

const retouch = async () => {
  const source = join(process.cwd(), 'public', 'products', '01.jpg');
  const sourceData = readFileSync(source);
  console.log(`исходник: ${source} (${Math.round(sourceData.length / 1024)} КБ)`);
  const { status, text } = await post('/chat/completions', {
    model: 'gemini-3.1-flash-image',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Это фотография нашего изделия. Сделай из неё аккуратное каталожное фото: убери фон, положи изделие на ровный светло-серый фон, выровняй свет. Само изделие не меняй: ни форму, ни цвет, ни швы, ни фурнитуру. Не добавляй ничего, чего нет на фото.' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${sourceData.toString('base64')}` } },
      ],
    }],
  });
  console.log('статус:', status, '| ответ:', Math.round(text.length / 1024), 'КБ');
  const image = pullImage(text);
  console.log(image ? `картинка: ${save(image, 'retouch')}` : `картинки нет: ${text.slice(0, 300)}`);
};

const video = async () => {
  const attempts = [
    { path: '/videos/generations', body: { model: 'grok-imagine-video-1.5', prompt: 'Кожаный ремень на деревянном столе, медленный проход камеры, тёплый свет.', duration: 4 } },
    { path: '/videos/generations', body: { model: 'grok-imagine-video', prompt: 'Кожаный ремень на столе, медленный проход камеры.', seconds: 4 } },
  ];
  for (const attempt of attempts) {
    const { status, text } = await post(attempt.path, attempt.body);
    console.log(`${attempt.body.model}: статус ${status} | ${text.slice(0, 300)}`);
  }
};

const check = async () => {
  const source = readFileSync(join(process.cwd(), 'public', 'products', '01.jpg')).toString('base64');
  const draft = readFileSync(join(OUT, 'retouch.png')).toString('base64');
  const { status, text } = await post('/chat/completions', {
    model: 'gemini-3.1-flash-lite',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Первое изображение — исходное фото изделия, второе — обработанный черновик для каталога. Сравни и ответь строго JSON без пояснений: {"same_object":true|false,"changed":["что изменилось в самом изделии"],"background_clean":true|false,"invented_items":["что появилось такого, чего нет на исходнике"],"fit_for_catalog":true|false}' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${source}` } },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${draft}` } },
      ],
    }],
  });
  console.log('статус:', status);
  console.log(text.slice(0, 1200));
};

const STRICT = 'Задача: только фон. Возьми изделие с фотографии ровно как есть и положи его на ровный светло-серый фон (#e8e8e6), мягкий рассеянный свет, тень под изделием.\n'
  + 'Запрещено: менять форму, силуэт, цвет, оттенок кожи, швы, прострочку, фурнитуру, тиснение, количество отделений и вырезов; дорисовывать детали, которых нет на фото; убирать детали, которые есть; добавлять текст, логотипы, людей, реквизит.\n'
  + 'Разрешено: заменить фон, выровнять освещение, убрать пылинки. Изделие должно остаться узнаваемо тем же самым предметом.';

const strict = async (args) => {
  const model = args[0] || 'gpt-image-2';
  const sourceData = readFileSync(join(process.cwd(), 'public', 'products', '01.jpg'));
  const { status, text } = await post('/chat/completions', {
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: STRICT },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${sourceData.toString('base64')}` } },
      ],
    }],
  });
  console.log(`${model}: статус ${status}, ответ ${Math.round(text.length / 1024)} КБ`);
  const image = pullImage(text);
  if (!image) {
    console.log('картинки нет:', text.slice(0, 400));
    return;
  }
  const name = `strict-${model}`;
  console.log('картинка:', save(image, name));
  const saved = join(OUT, `${name}.png`);
  const verdict = await compare(join(process.cwd(), 'public', 'products', '01.jpg'), saved);
  console.log('проверка зрения:', verdict);
};

/** Сверка черновика с исходником: то, чего требует навык фабрики. */
const compare = async (sourcePath, draftPath) => {
  const source = readFileSync(sourcePath).toString('base64');
  const draft = readFileSync(draftPath).toString('base64');
  const { text } = await post('/chat/completions', {
    model: 'gemini-3.1-flash-lite',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Первое изображение — исходное фото изделия, второе — обработанный черновик для каталога. Сравни и ответь строго JSON без пояснений: {"same_object":true|false,"changed":["что изменилось в самом изделии"],"background_clean":true|false,"invented_items":["что появилось такого, чего нет на исходнике"],"fit_for_catalog":true|false}' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${source}` } },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${draft}` } },
      ],
    }],
  });
  const body = JSON.parse(text).choices?.[0]?.message?.content ?? '';
  return body.replace(/\s+/g, ' ').slice(0, 600);
};

const commands = { photo, retouch, video, check, strict };
const run = commands[process.argv[2]];
if (!run) {
  console.log('что проверять: photo | retouch | video');
  process.exit(1);
}
await run(process.argv.slice(3));
