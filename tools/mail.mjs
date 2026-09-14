#!/usr/bin/env node
/**
 * Почта агента: временный ящик через API mail.tm.
 *
 * Зачем: для регистрации в сервисах нужен адрес, который принимает письма,
 * а заводить личный ящик с телефоном и паспортом ради этого не нужно.
 * Ящик создаётся программно, пароль генерируется, ничего личного не хранится.
 *
 * Команды:
 *   node tools/mail.mjs init            создать ящик (адрес и пароль в ~/.takandrat/mail.json, 600)
 *   node tools/mail.mjs address         показать текущий адрес
 *   node tools/mail.mjs list            список писем
 *   node tools/mail.mjs read <id>       письмо целиком, со ссылками
 *   node tools/mail.mjs wait            ждать письмо (для подтверждения регистрации)
 *
 * Ограничение, о котором надо помнить: временные домены знают в лицо, и часть
 * сервисов такие адреса отвергает. Если сервис не принимает адрес — это его
 * решение, а не поломка инструмента.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const API = 'https://api.mail.tm';
const CONFIG = process.env.AGENT_MAIL_CONFIG || join(homedir(), '.takandrat', 'mail.json');

const read = (file) => {
  if (!existsSync(file)) throw new Error(`ящика нет: ${file}. Сначала: node tools/mail.mjs init`);
  return JSON.parse(readFileSync(file, 'utf8'));
};

const save = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
};

const call = async (path, { method = 'GET', body, token } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data?.['hydra:description'] || data?.detail || text.slice(0, 200);
    throw new Error(`${method} ${path} → ${response.status}: ${detail}`);
  }
  return data;
};

/** Токен живёт час; при 401 молча берём новый по сохранённому паролю. */
const withToken = async (account, run) => {
  try {
    return await run(account.token);
  } catch (error) {
    if (!/401/.test(error.message)) throw error;
    const fresh = await call('/token', { method: 'POST', body: { address: account.address, password: account.password } });
    const updated = { ...account, token: fresh.token, tokenId: fresh.id, tokenAt: new Date().toISOString() };
    save(CONFIG, updated);
    return run(updated.token);
  }
};

const activeDomains = async () => {
  const data = await call('/domains?page=1');
  return (data?.['hydra:member'] || [])
    .filter((item) => item.isActive && !item.isPrivate)
    .map((item) => item.domain);
};

const extractLinks = (text) => [...new Set(
  (text.match(/https?:\/\/[^\s"'<>)\]]+/g) || []).map((url) => url.replace(/[.,;]+$/, '')),
)];

const messageText = (message) => {
  const body = message.text || (message.html || []).join('\n')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  return body.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
};

const showMessage = (message, { withLinks = true } = {}) => {
  const from = message.from?.address || '?';
  console.log(`от:    ${message.from?.name ? `${message.from.name} ` : ''}<${from}>`);
  console.log(`тема:  ${message.subject || '(без темы)'}`);
  console.log(`дата:  ${message.createdAt}`);
  console.log('');
  const body = messageText(message);
  console.log(body.length > 4000 ? `${body.slice(0, 4000)}\n… (письмо длиннее, показаны первые 4000 знаков)` : body);
  if (withLinks) {
    const links = extractLinks(`${message.text || ''}\n${(message.html || []).join('\n')}`);
    if (links.length > 0) {
      console.log('\nссылки:');
      for (const link of links) console.log(`  ${link}`);
    }
  }
};

const commands = {
  async init(args) {
    const domains = await activeDomains();
    if (domains.length === 0) throw new Error('mail.tm не отдал ни одного активного домена');
    const domain = args[0]?.includes('@') ? null : (args[0] || domains[0]);
    const address = args[0]?.includes('@')
      ? args[0]
      : `${args[1] || `tak-rat-${randomBytes(3).toString('hex')}`}@${domain}`;
    const password = randomBytes(18).toString('base64url');

    const account = await call('/accounts', { method: 'POST', body: { address, password } });
    const token = await call('/token', { method: 'POST', body: { address, password } });
    save(CONFIG, {
      address,
      password,
      accountId: account.id,
      token: token.token,
      tokenId: token.id,
      tokenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      provider: 'mail.tm',
    });
    console.log(`ящик создан: ${address}`);
    console.log(`пароль и токен: ${CONFIG} (права 600)`);
    console.log('домен временный: часть сервисов такие адреса отвергает — это их решение, не поломка.');
  },

  async address() {
    if (!existsSync(CONFIG)) throw new Error(`ящика нет: ${CONFIG}. Сначала: node tools/mail.mjs init`);
    console.log(read(CONFIG).address);
  },

  async list() {
    const account = read(CONFIG);
    const data = await withToken(account, (token) => call('/messages?page=1', { token }));
    const messages = data?.['hydra:member'] || [];
    if (messages.length === 0) {
      console.log(`писем нет (ящик ${account.address})`);
      return;
    }
    console.log(`ящик ${account.address}, писем: ${data['hydra:totalItems'] ?? messages.length}`);
    for (const message of messages) {
      console.log(`  ${message.id}  ${message.createdAt}  ${message.from?.address || '?'}  ${message.subject || '(без темы)'}`);
    }
  },

  async read(args) {
    const account = read(CONFIG);
    const id = args[0];
    if (!id) throw new Error('укажите id письма: node tools/mail.mjs read <id>');
    const message = await withToken(account, (token) => call(`/messages/${id}`, { token }));
    if (message.seen === false) {
      await withToken(account, (token) => call(`/messages/${id}`, { method: 'PATCH', body: { seen: true }, token })).catch(() => {});
    }
    showMessage(message);
  },

  async wait(args) {
    const account = read(CONFIG);
    const seconds = Number(args.find((a) => /^\d+$/.test(a)) || 120);
    const wanted = args.find((a) => a.startsWith('--from='))?.slice(7);
    const subject = args.find((a) => a.startsWith('--subject='))?.slice(10);

    const before = new Set(
      ((await withToken(account, (token) => call('/messages?page=1', { token })))?.['hydra:member'] || [])
        .map((message) => message.id),
    );
    console.log(`жду письмо до ${seconds} с${wanted ? `, от ${wanted}` : ''}${subject ? `, тема содержит «${subject}»` : ''}…`);

    const deadline = Date.now() + seconds * 1000;
    while (Date.now() < deadline) {
      await sleep(5000);
      const data = await withToken(account, (token) => call('/messages?page=1', { token }));
      const fresh = (data?.['hydra:member'] || []).filter((message) => !before.has(message.id));
      const match = fresh.find((message) =>
        (!wanted || (message.from?.address || '').includes(wanted))
        && (!subject || (message.subject || '').toLowerCase().includes(subject.toLowerCase())));
      if (match) {
        const full = await withToken(account, (token) => call(`/messages/${match.id}`, { token }));
        console.log('\nписьмо пришло\n');
        showMessage(full);
        return;
      }
    }
    throw new Error(`за ${seconds} с письмо не пришло (ящик ${account.address})`);
  },

  async forget() {
    if (!existsSync(CONFIG)) {
      console.log('и так пусто');
      return;
    }
    const account = read(CONFIG);
    await call(`/accounts/${account.accountId}`, { method: 'DELETE', token: account.token }).catch(() => {});
    writeFileSync(CONFIG, '{}\n', { mode: 0o600 });
    console.log(`ящик ${account.address} удалён`);
  },
};

const [command, ...args] = process.argv.slice(2);
const run = commands[command];
if (!run) {
  console.log('команды: init [адрес|домен] [имя] | address | list | read <id> | wait [секунды] [--from=адрес] [--subject=текст] | forget');
  process.exit(command ? 1 : 0);
}
try {
  await run(args);
} catch (error) {
  console.error(`ошибка: ${error.message}`);
  process.exit(1);
}
