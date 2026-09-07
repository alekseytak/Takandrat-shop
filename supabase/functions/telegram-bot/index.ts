// Hardened Telegram bot webhook with X-Telegram-Bot-Api-Secret-Token verification.
import { Bot, webhookCallback } from 'https://deno.land/x/grammy@v1.20.3/mod.ts';

declare const Deno: any;

const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");

const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
if (!webhookSecret) {
  console.warn('[telegram-bot] WARNING: TELEGRAM_WEBHOOK_SECRET not set — webhook is unauthenticated. Set this in Supabase secrets.');
}

const bot = new Bot(token);

bot.command('start', (ctx) => {
  const webAppUrl = Deno.env.get('FRONTEND_URL') || 'https://takandrat-shop.vercel.app';
  return ctx.reply("TAK AND RAT // SYSTEM ONLINE\n\nДобро пожаловать в магазин премиальных лонгсливов.\nНажмите кнопку ниже, чтобы открыть каталог.", {
    reply_markup: { inline_keyboard: [[{ text: "Открыть Каталог ⬛", web_app: { url: webAppUrl } }]] },
  });
});

bot.command('help', (ctx) =>
  ctx.reply("Доступные команды:\n/start — открыть каталог\n/catalog — открыть каталог")
);

bot.command('catalog', (ctx) => {
  const webAppUrl = Deno.env.get('FRONTEND_URL') || 'https://takandrat-shop.vercel.app';
  return ctx.reply("Каталог:", {
    reply_markup: { inline_keyboard: [[{ text: "Открыть Каталог ⬛", web_app: { url: webAppUrl } }]] },
  });
});

bot.on("message", (ctx) =>
  ctx.reply("Используйте кнопку 'Открыть Каталог' для доступа к магазину.")
);

const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve(async (req: any) => {
  try {
    if (req.method !== 'POST') {
      return new Response("Method not allowed", { status: 405 });
    }
    if (webhookSecret) {
      const headerToken = req.headers.get('x-telegram-bot-api-secret-token');
      if (headerToken !== webhookSecret) {
        return new Response("Forbidden", { status: 403 });
      }
    }
    return await handleUpdate(req);
  } catch (err: any) {
    console.error(err);
    return new Response(err.message, { status: 500 });
  }
});
