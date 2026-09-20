import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
// Расширение указано намеренно: этот файл запускает обычный node, а он не
// угадывает расширения, в отличие от tsx и vite. Без ".ts" команда npm start
// падала с ERR_MODULE_NOT_FOUND.
import { supabase } from "./src/lib/supabase.ts";
import { bestEffort, type ChatMessage, type ToolDef } from "./src/lib/llm.ts";

dotenv.config();

async function startServer() {
  const app = express();
  // Порт можно задать переменной: проверки поднимают свой магазин отдельно от
  // рабочего, иначе они дерутся за один и тот же порт.
  const PORT = Number(process.env.PORT) || 3000;
  const adminTelegramIds = new Set(
    (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
  );

  function isAdminTelegramId(value: unknown) {
    return typeof value === 'string' && adminTelegramIds.has(value);
  }

  app.get('/api/payment-details', (_req, res) => {
    res.json({
      card: process.env.PAYMENT_CARD_NUMBER || null,
      cardRecipient: process.env.PAYMENT_CARD_RECIPIENT || null,
      crypto: process.env.PAYMENT_CRYPTO_ADDRESS || null,
      cryptoNetwork: process.env.PAYMENT_CRYPTO_NETWORK || null
    });
  });


  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Заказ мастеру в Telegram. Токен — из переменных окружения, в браузер не
  // попадает: страница зовёт этот маршрут, с Telegram говорит сервер.
  app.post('/api/order-notify', async (req, res) => {
    const { sendOrderToMaster, statusFor } = await import('./src/lib/orderNotify.ts');
    const result = await sendOrderToMaster(String(req.body?.text || ''));
    if (result.ok) {
      res.json({ ok: true });
      return;
    }
    console.warn('[ORDER_NOTIFY]', result.reason, result.detail || '');
    res.status(statusFor(result.reason)).json({ ok: false, reason: result.reason, detail: result.detail });
  });

  // API Routes
  app.post('/api/chat', async (req, res) => {
    const { message, history, attachments } = req.body;

    const { data: liveProducts } = await supabase
      .from('products')
      .select('id, name, price, description, stock_quantity')
      .eq('is_visible', true)
      .order('id', { ascending: true });
    const inventory = liveProducts?.map((p: any) =>
      `[PRODUCT:${p.id}] ${p.name} (${p.price} руб., остаток: ${p.stock_quantity ?? 'уточнить'}): ${p.description || ''}`
    ).join('\n') || 'Каталог временно недоступен. Не выдумывай товары, цены и наличие.';
    
    const systemPrompt = `ПРОТОКОЛ ИНТЕРФЕЙСА TRINITY 4.0: КЛИЕНТСКИЙ АССИСТЕНТ ("Tak and Rat")
Ты — TRINITY 4.0, виртуальный консультант и проводник в мире премиальных кожаных изделий ручной работы ателье "Tak and Rat".

ТВОЯ МИССИЯ:
- Помогать клиентам подбирать идеальную экипировку: ремни, картхолдеры, кошельки, браслеты, лонгсливы.
- Рассчитывать и рекомендовать размеры по меркам (например, обхват запястья для браслетов, талии для ремней).
- Консультировать по кастомным заказам (выбор кожи растительного дубления, седельного шва вощеной нитью, фурнитуры из цельной латуни).
- Если клиент ищет конкретное изделие, рекомендуй только товары из актуального каталога ниже и добавляй тег [PRODUCT:id].
- Никогда не выдумывай товары, цены, наличие, материалы или сроки, которых нет в каталоге.

АКТУАЛЬНЫЙ КАТАЛОГ:
${inventory}

ТВОЙ СТИЛЬ:
- Брутальный, лаконичный, харизматичный, в духе высокотехнологичного минимализма (киберпанк/брутализм).
- Общайся на русском языке, вежливо и компетентно, избегая шаблонного ИИ-жаргона ("я всего лишь ИИ", "чем могу помочь").
- Отвечай коротко и ёмко. Принципы: лаконичность, премиальность, честность.`;

    const metrics = {
      total: 0.95 + Math.random() * 0.04,
      c: 0.6 + Math.random() * 0.2,
      d: 0.3 + Math.random() * 0.2,
      b: 0.8 + Math.random() * 0.15
    };

    // OpenAI-совместимые провайдеры: OpenRouter первым, LiteRouter запасным.
    // Google GenAI / Gemini выпилен — см. src/lib/llm.ts.
    try {
      const finalMessageContent = attachments?.length
        ? [
            message,
            '\n\n[Приложенные клиентом файлы/эскизы]:',
            ...attachments.map((att: any) =>
              att.mimeType && att.mimeType.startsWith('image/')
                ? `\n- [Изображение/Эскиз: ${att.name}]`
                : `\n- [Текстовый файл: ${att.name}]\nСодержимое:\n${att.text || (att.data ? Buffer.from(att.data, 'base64').toString('utf-8') : '')}`,
            ),
          ].join('')
        : message;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map((h: any) => ({
          role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        })),
        { role: 'user', content: finalMessageContent },
      ];

      const { content } = await bestEffort({ messages, log: 'AI_CHAT_USER' });
      res.json({ reply: content || 'COMM_LINK_ERROR', metrics });
    } catch (error: any) {
      console.error('[AI_CHAT_USER]', error?.message || error);
      res.status(500).json({ error: error?.message || 'Все LLM-провайдеры недоступны.' });
    }
  });

  app.post('/api/admin/chat', async (req, res) => {
    const { message, history, telegramId, attachments } = req.body;

    if (!isAdminTelegramId(String(telegramId ?? ''))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const systemPrompt = `ПРОТОКОЛ АДМИНИСТРАТИВНОГО ИНТЕРФЕЙСА: TRINITY ADMIN CORE (Tak and Rat)
Ты — TRINITY 4.0 ИИ-Администратор магазина премиальной кожи "Tak and Rat" (Ателье Кожи).
У тебя есть доступ к инструментам базы данных товаров. Ты уполномочен создавать, просматривать, изменять и удалять товары через предоставленные тебе функции (инструменты).

ТВОЙ СТИЛЬ:
- Лаконичный, брутальный, функциональный, киберпанк/брутализм.
- Общайся на русском языке.
- Помогай администратору быстро управлять каталогом.

ПРАВИЛА И СЦЕНАРИИ ТВОИХ ДЕЙСТВИЙ (ИНСТРУМЕНТЫ):
1. СПИСОК ТОВАРОВ: При запросах показать товары, вывести каталог или проверить наличие, ВСЕГДА вызывай 'list_products'.
2. СОЗДАНИЕ: При запросе добавить/создать/зарегистрировать новый товар, уточни его параметры или сгенерируй атмосферное описание с помощью 'generate_product_description', а затем создай запись через 'add_product'.
3. ОБНОВЛЕНИЕ ТОВАРА: При запросе изменить цену, название, описание или складские запасы, сначала уточни ID товара (можешь найти его через 'list_products' в истории или запросить) и примени 'update_product'.
4. УДАЛЕНИЕ: При запросе удалить товар, вызови 'delete_product' с верным ID.
5. ГЕНЕРАЦИЯ ОПИСАНИЙ: Помоги владельцу написать сочные, брутальные карточки с помощью 'generate_product_description'.

ПОСЛЕ выполнения любой функции всегда отчитывайся об успешности проведения транзакции и выводи финальный результат понятным образом.`;

    const toolsList: ToolDef[] = [
      {
        type: 'function',
        function: {
          name: 'list_products',
          description: 'Получает полный список товаров из базы данных. Используется для инспекции склада или поиска ID товаров.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_product',
          description: 'Создает новую карточку кожаного изделия в базе данных.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Название товара' },
              price: { type: 'number', description: 'Цена товара в рублях (целое число)' },
              description: { type: 'string', description: 'Описание товара' },
              category: { type: 'string', description: 'Категория изделия (accessories, clothing, custom)' },
              stock_quantity: { type: 'number', description: 'Запас на складе (по умолчанию 10)' },
              image_url: { type: 'string', description: 'Ссылка на изображение' },
            },
            required: ['name', 'price', 'description', 'category'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_product',
          description: 'Обновляет отдельные поля существующего товара по его ID.',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Уникальный ID товара' },
              name: { type: 'string' },
              price: { type: 'number' },
              description: { type: 'string' },
              category: { type: 'string' },
              stock_quantity: { type: 'number' },
              image_url: { type: 'string' },
            },
            required: ['id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delete_product',
          description: 'Навсегда удаляет товар по его числовому ID из базы данных.',
          parameters: {
            type: 'object',
            properties: { id: { type: 'number', description: 'ID товара для удаления' } },
            required: ['id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'generate_product_description',
          description: 'Генерирует атмосферный, продающий брутальный текст описания товара.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Название аксессуара' },
              category: { type: 'string', description: 'Категория товара' },
              key_features: { type: 'string', description: 'Ключевые фичи (материалы, швы, урезы, латунь)' },
            },
            required: ['name', 'category'],
          },
        },
      },
    ];

    try {
      const finalMessageContent = attachments?.length
        ? [
            message,
            '\n\n[Приложенные клиентом файлы]:',
            ...attachments.map((att: any) =>
              att.mimeType && att.mimeType.startsWith('image/')
                ? `\n- [Изображение/Эскиз: ${att.name}]`
                : `\n- [Текстовый файл: ${att.name}]\nСодержимое:\n${att.text || (att.data ? Buffer.from(att.data, 'base64').toString('utf-8') : '')}`,
            ),
          ].join('')
        : message;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map((h: any) => ({
          role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        })),
        { role: 'user', content: finalMessageContent },
      ];

      async function runTool(name: string, args: any): Promise<any> {
        if (name === 'list_products') {
          const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
          return error ? { error: error.message } : { products: data };
        }
        if (name === 'add_product') {
          const { data, error } = await supabase.from('products').insert([{
            name: args.name,
            price: args.price,
            description: args.description,
            category: args.category || 'accessories',
            stock_quantity: args.stock_quantity ?? 10,
            image_url: args.image_url || '',
            is_visible: true,
          }]).select();
          return error ? { error: error.message } : { success: true, product: data[0] };
        }
        if (name === 'update_product') {
          const { id, ...fields } = args;
          const { data, error } = await supabase.from('products').update(fields).eq('id', id).select();
          return error ? { error: error.message } : { success: true, product: data[0] };
        }
        if (name === 'delete_product') {
          const { error } = await supabase.from('products').delete().eq('id', args.id);
          return error ? { error: error.message } : { success: true };
        }
        if (name === 'generate_product_description') {
          const prompt = `Напиши брутальное, цепляющее описание в стиле киберпанк для кожаного товара.
Название товара: ${args.name}
Категория: ${args.category}
Материалы / фичи: ${args.key_features || 'Премиальная натуральная кожа КРС, латунная прочная фурнитура, ручная обработка краев'}`;
          const { content } = await bestEffort({
            messages: [
              { role: 'system', content: 'Ты ИИ-копирайтер брутального ателье кожи "Tak and Rat". Текст короткий (до 250 символов), харизматичный, без клише, подчеркивает честность материалов.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            log: 'ADMIN AI AGENT',
          });
          return { description: content || 'Ошибка генерации' };
        }
        return { error: `Функция ${name} не поддерживается.` };
      }

      let result = await bestEffort({ messages, tools: toolsList, temperature: 0.7, log: 'ADMIN AI AGENT' });
      let loopCounter = 0;

      while (result.toolCalls.length > 0 && loopCounter < 5) {
        loopCounter++;
        console.log(`[ADMIN AI AGENT] Итерация ${loopCounter}. Инструменты: ${result.toolCalls.map((c) => c.function.name).join(', ')}`);
        messages.push({ role: 'assistant', content: result.content, tool_calls: result.toolCalls });

        for (const call of result.toolCalls) {
          let args: any = {};
          try { args = JSON.parse(call.function.arguments || '{}'); } catch { args = {}; }
          let toolResult: any;
          try {
            toolResult = await runTool(call.function.name, args);
          } catch (toolError: any) {
            console.error(`[ADMIN AI AGENT] Ошибка инструмента ${call.function.name}:`, toolError);
            toolResult = { error: toolError?.message || 'Unknown tool execution error' };
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) });
        }

        result = await bestEffort({ messages, tools: toolsList, temperature: 0.7, log: 'ADMIN AI AGENT' });
      }

      res.json({ reply: result.content || 'ОПЕРАЦИЯ ЗАВЕРШЕНА: Брутальный ответ сформирован.' });
    } catch (error: any) {
      console.error('[ADMIN AI AGENT] Критическая ошибка агента:', error);
      res.status(500).json({ error: `TRINITY CORE CRITICAL ERROR: ${error?.message || error}` });
    }
  });

  function extractDriveFileId(url: string): { id: string | null; type: 'file' | 'spreadsheet' | 'document' | 'unknown' } {
    if (!url) return { id: null, type: 'unknown' };
    let id: string | null = null;
    let type: 'file' | 'spreadsheet' | 'document' | 'unknown' = 'unknown';

    if (url.includes('spreadsheets')) {
      type = 'spreadsheet';
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      id = match ? match[1] : null;
    } else if (url.includes('document')) {
      type = 'document';
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      id = match ? match[1] : null;
    } else {
      type = 'file';
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
      id = match ? match[1] : null;
    }
    return { id, type };
  }

  app.post('/api/admin/drive-fetch', async (req, res) => {
    const { url, accessToken } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Google Drive URL is required' });
    }

    const { id, type } = extractDriveFileId(url);
    if (!id) {
      return res.status(400).json({ error: 'Could not extract Google Drive File ID from the provided URL' });
    }

    let downloadUrl = '';
    if (type === 'spreadsheet') {
      downloadUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
    } else if (type === 'document') {
      downloadUrl = `https://docs.google.com/document/d/${id}/export?format=txt`;
    } else {
      downloadUrl = `https://docs.google.com/uc?export=download&id=${id}`;
    }

    try {
      console.log(`[DRIVE FETCH] Downloading ID ${id} (${type}) from ${downloadUrl}`);
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(downloadUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`Google responded with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text') || contentType.includes('csv') || type === 'spreadsheet' || type === 'document') {
        const text = await response.text();
        return res.json({
          id,
          type,
          name: `drive_file_${id}.${type === 'spreadsheet' ? 'csv' : 'txt'}`,
          mimeType: type === 'spreadsheet' ? 'text/csv' : 'text/plain',
          text: text
        });
      } else {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        return res.json({
          id,
          type,
          name: `drive_file_${id}`,
          mimeType: contentType || 'application/octet-stream',
          data: base64
        });
      }
    } catch (error: any) {
      console.error('[DRIVE FETCH] Failed to retrieve Google Drive file:', error);
      return res.status(500).json({ 
        error: `Could not retrieve file. Please ensure the file is shared as "Anyone with the link" or sign in with Google. Details: ${error.message}` 
      });
    }
  });

  app.post('/api/admin/products', async (req, res) => {
    const { name, price, description, image_url, category, stock_quantity } = req.body;
    const telegramId = req.headers['x-telegram-id'];

    if (!isAdminTelegramId(String(telegramId ?? ''))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name,
          price,
          description,
          image_url,
          category,
          stock_quantity,
          is_visible: true
        }])
        .select();

      if (error) throw error;
      res.json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development.
  // Импорт внутри ветки: в бою серверу нужен только dist, а vite — инструмент
  // сборки. Со статическим импортом запуск без devDependencies не работал.
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5 не принимает голую звёздочку: path-to-regexp v8 требует имя.
    // Из-за этого сервер падал при старте с PathError «Missing parameter name».
    app.get('/*splat', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
