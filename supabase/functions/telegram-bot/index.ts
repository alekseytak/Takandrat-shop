// Follow this setup guide to integrate the Deno runtime into your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs on Supabase Edge Functions (Deno)

import { Bot, webhookCallback } from 'https://deno.land/x/grammy@v1.20.3/mod.ts';

// Declare Deno global to fix TypeScript errors when not using Deno runtime directly in IDE
declare const Deno: any;

const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");

const bot = new Bot(token);

// Обработка команды /start
bot.command('start', (ctx) => {
  const webAppUrl = Deno.env.get('FRONTEND_URL') || 'https://tak-and-rat.pages.dev';
  
  return ctx.reply("TAK AND RAT // SYSTEM ONLINE\n\nДобро пожаловать в магазин премиальных лонгсливов.\nНажмите кнопку ниже, чтобы открыть каталог.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть Каталог ⬛", web_app: { url: webAppUrl } }]
      ]
    }
  });
});

// Обработка всех остальных сообщений
bot.on("message", (ctx) => {
    return ctx.reply("Используйте кнопку 'Открыть Каталог' для доступа к магазину.");
});

// Запуск вебхука
const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve(async (req: any) => {
  try {
    const url = new URL(req.url);
    
    // Простая защита от спама, если нужно (можно настроить Secret Token в Telegram)
    if (req.method !== 'POST') {
        return new Response("Method not allowed", { status: 405 });
    }

    return await handleUpdate(req);
  } catch (err: any) {
    console.error(err);
    return new Response(err.message, { status: 500 });
  }
});