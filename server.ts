import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { supabase } from "./src/lib/supabase";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // API Routes
  app.post('/api/chat', async (req, res) => {
    const { message, history, attachments } = req.body;
    
    const systemPrompt = `ПРОТОКОЛ ИНТЕРФЕЙСА TRINITY 4.0: КЛИЕНТСКИЙ АССИСТЕНТ ("Tak and Rat")
Ты — TRINITY 4.0, виртуальный консультант и проводник в мире премиальных кожаных изделий ручной работы ателье "Tak and Rat".

ТВОЯ МИССИЯ:
- Помогать клиентам подбирать идеальную экипировку: ремни, картхолдеры, кошельки, браслеты, лонгсливы.
- Рассчитывать и рекомендовать размеры по меркам (например, обхват запястья для браслетов, талии для ремней).
- Консультировать по кастомным заказам (выбор кожи растительного дубления, седельного шва вощеной нитью, фурнитуры из цельной латуни).
- Если клиент ищет конкретное изделие, ты можешь порекомендовать товары, упомянув специальный тег [PRODUCT:id] прямо в тексте (доступные id: ch-01, b-01, w-03, s-07, tr-01, tr-04). Это мгновенно откроет красивую карточку товара у клиента.

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

    // 1. ПРИОРИТЕТ: ВЫЗОВ OPENROUTER (по запросу пользователя)
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const openRouterModels = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'meta-llama/llama-3-8b-instruct:free',
      'qwen/qwen-2.5-7b-instruct:free',
      'google/gemma-2-9b-it:free',
      'mistralai/mistral-7b-instruct:free'
    ];

    let lastOpenRouterError: any = null;

    if (openrouterKey) {
      for (const orModel of openRouterModels) {
        try {
          console.log(`[AI_CHAT_USER] Инициализация вызова OpenRouter API (${orModel})...`);
          
          // Преобразуем вложения в текстовый формат для OpenRouter, если они есть
          let finalMessageContent = message;
          if (attachments && attachments.length > 0) {
            finalMessageContent += '\n\n[Приложенные клиентом файлы/эскизы]:';
            for (const att of attachments) {
              if (att.mimeType && att.mimeType.startsWith('image/')) {
                finalMessageContent += `\n- [Изображение/Эскиз: ${att.name}]`;
              } else {
                finalMessageContent += `\n- [Текстовый файл: ${att.name}]\nСодержимое:\n${att.text || (att.data ? Buffer.from(att.data, 'base64').toString('utf-8') : '')}`;
              }
            }
          }

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
              'X-Title': 'Tak and Rat Shop Assistant',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: orModel,
              messages: [
                { role: 'system', content: systemPrompt },
                ...(history || []).map((h: any) => ({
                  role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
                  content: h.content
                })),
                { role: 'user', content: finalMessageContent }
              ],
            }),
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorData = await response.json();
              if (errorData.error && errorData.error.message) {
                errorMessage = errorData.error.message;
              } else {
                errorMessage = JSON.stringify(errorData);
              }
            } catch (e) {
              errorMessage = await response.text();
            }
            throw new Error(errorMessage);
          }

          const data = await response.json();
          const reply = data.choices?.[0]?.message?.content || "COMM_LINK_ERROR";
          return res.json({ reply, metrics });
        } catch (orError: any) {
          lastOpenRouterError = orError;
          console.warn(`[AI_CHAT_USER] Ошибка OpenRouter для модели ${orModel}: ${orError.message || orError}. Пробуем следующую...`);
        }
      }
      console.warn("[AI_CHAT_USER] Все модели OpenRouter не ответили. Переход к резервному Gemini...");
    }

    // 2. РЕЗЕРВНЫЙ ВАРИАНТ (FALLBACK): ОФИЦИАЛЬНЫЙ GOOGLE GEMINI API
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const geminiModels = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      let lastGeminiError: any = null;

      for (const geminiModel of geminiModels) {
        try {
          console.log(`[AI_CHAT_USER] Резервный вызов Google Gemini API (${geminiModel})...`);
          const ai = getGeminiClient();
          
          const mappedContents = (history || []).map((h: any) => ({
            role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.content }]
          }));
          
          const latestParts: any[] = [{ text: message }];

          if (attachments && attachments.length > 0) {
            for (const att of attachments) {
              if (att.mimeType && att.mimeType.startsWith('image/')) {
                latestParts.push({
                  inlineData: {
                    data: att.data,
                    mimeType: att.mimeType
                  }
                });
              } else {
                latestParts.push({
                  text: `\n[Прикрепленный файл: ${att.name}]\nСодержимое:\n${att.text || (att.data ? Buffer.from(att.data, 'base64').toString('utf-8') : '')}`
                });
              }
            }
          }

          mappedContents.push({
            role: 'user',
            parts: latestParts
          });

          const response = await ai.models.generateContent({
            model: geminiModel,
            contents: mappedContents,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
            }
          });

          const reply = response.text || "COMM_LINK_ERROR";
          return res.json({ reply, metrics });
        } catch (geminiError: any) {
          lastGeminiError = geminiError;
          console.warn(`[AI_CHAT_USER] Ошибка Gemini API: ${geminiError.message || geminiError}. Пробуем следующую модель...`);
        }
      }
      return res.status(500).json({ error: `Все провайдеры ИИ исчерпали лимиты. Последняя ошибка OpenRouter: ${lastOpenRouterError?.message || lastOpenRouterError}. Последняя ошибка Gemini: ${lastGeminiError?.message || lastGeminiError}` });
    }

    res.status(500).json({ error: 'Идентификационные ключи OPENROUTER_API_KEY и GEMINI_API_KEY отсутствуют или некорректны.' });
  });

  app.post('/api/admin/chat', async (req, res) => {
    const { message, history, telegramId, attachments } = req.body;

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

    const toolsList = [
      {
        name: 'list_products',
        description: 'Получает полный список товаров из базы данных. Используется для инспекции склада или поиска ID товаров.',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'add_product',
        description: 'Создает новую карточку кожаного изделия в базе данных.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Название товара (например: "Ремень латунный Brutal")' },
            price: { type: 'NUMBER', description: 'Цена товара в рублях (целое число, напр: 3900)' },
            description: { type: 'STRING', description: 'cyberpunk/minimalist сочное описание' },
            category: { type: 'STRING', description: 'Категория изделия (accessories, clothing, custom)' },
            stock_quantity: { type: 'NUMBER', description: 'Запас на складе (по умолчанию 10)' },
            image_url: { type: 'STRING', description: 'Ссылка на изображение. По умолчанию можно использовать качественный плейсхолдер.' }
          },
          required: ['name', 'price', 'description', 'category']
        }
      },
      {
        name: 'update_product',
        description: 'Обновляет مشخصные поля существующего кожаного изделия по его ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            id: { type: 'NUMBER', description: 'Уникальный ID товара в базе данных Supabase' },
            name: { type: 'STRING', description: 'Новое имя товара' },
            price: { type: 'NUMBER', description: 'Новая цена в рублях' },
            description: { type: 'STRING', description: 'Новое описание' },
            category: { type: 'STRING', description: 'Новая категория' },
            stock_quantity: { type: 'NUMBER', description: 'Новый объем остатков' },
            image_url: { type: 'STRING', description: 'Новая ссылка на фото' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_product',
        description: 'Навсегда удаляет товар по его числовому ID из базы данных.',
        parameters: {
          type: 'OBJECT',
          properties: {
            id: { type: 'NUMBER', description: 'ID товара для удаления' }
          },
          required: ['id']
        }
      },
      {
        name: 'generate_product_description',
        description: 'Генерирует невероятно атмосферный, продающий брутальный текст описания товара.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Название аксессуара' },
            category: { type: 'STRING', description: 'Категория товара' },
            key_features: { type: 'STRING', description: 'Ключевые фичи (материалы, швы, урезы, латунь)' }
          },
          required: ['name', 'category']
        }
      }
    ];

    try {
      console.log(`[ADMIN AI AGENT] Получен запрос от админа...`);
      const ai = getGeminiClient();

      // Маппим историю во внутренний формат Gemini
      const mappedContents: any[] = (history || []).map((h: any) => ({
        role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));

      const latestParts: any[] = [{ text: message }];

      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          if (att.mimeType && att.mimeType.startsWith('image/')) {
            latestParts.push({
              inlineData: {
                data: att.data,
                mimeType: att.mimeType
              }
            });
          } else {
            latestParts.push({
              text: `\n[Прикрепленный файл: ${att.name}]\nСодержимое:\n${att.text || (att.data ? Buffer.from(att.data, 'base64').toString('utf-8') : '')}`
            });
          }
        }
      }

      mappedContents.push({
        role: 'user',
        parts: latestParts
      });

      const adminModels = [
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite'
      ];

      async function executeWithFallback(contents: any[], config: any) {
        let lastError: any = null;
        for (const modelName of adminModels) {
          try {
            console.log(`[ADMIN AI AGENT] Попытка генерации через модель: ${modelName}`);
            const res = await ai.models.generateContent({
              model: modelName,
              contents,
              config
            });
            return { response: res, activeModel: modelName };
          } catch (err: any) {
            lastError = err;
            console.warn(`[ADMIN AI AGENT] Ошибка модели ${modelName}: ${err.message || err}. Пробуем следующую...`);
          }
        }
        throw new Error(`Все модели Gemini в панели администратора израсходовали лимиты или недоступны. Последняя ошибка: ${lastError?.message || lastError}`);
      }

      let { response, activeModel } = await executeWithFallback(mappedContents, {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toolsList }],
        temperature: 0.7
      });

      let loopCounter = 0;
      let functionCalls = response.functionCalls;

      while (functionCalls && functionCalls.length > 0 && loopCounter < 5) {
        loopCounter++;
        console.log(`[ADMIN AI AGENT] Итерация ${loopCounter}. Инструменты для вызова:`, JSON.stringify(functionCalls));
        const toolResults: any[] = [];

        for (const call of functionCalls) {
          const { name, args } = call;
          let result: any = {};

          try {
            if (name === 'list_products') {
              const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
              result = error ? { error: error.message } : { products: data };
            } else if (name === 'add_product') {
              const { data, error } = await supabase.from('products').insert([{
                name: args.name,
                price: args.price,
                description: args.description,
                category: args.category || 'accessories',
                stock_quantity: args.stock_quantity || 10,
                image_url: args.image_url || 'https://images.unsplash.com/photo-1547996160-81dfa63595aa',
                is_visible: true
              }]).select();
              result = error ? { error: error.message } : { success: true, product: data[0] };
            } else if (name === 'update_product') {
              const { id, ...fields } = args;
              const { data, error } = await supabase.from('products').update(fields).eq('id', id).select();
              result = error ? { error: error.message } : { success: true, product: data[0] };
            } else if (name === 'delete_product') {
              const { id } = args;
              const { error } = await supabase.from('products').delete().eq('id', id);
              result = error ? { error: error.message } : { success: true };
            } else if (name === 'generate_product_description') {
              const descPrompt = `Напиши брутальное, цепляющее описание в стиле киберпанк для кожаного товара.
              Название товара: ${args.name}
              Категория: ${args.category}
              Материалы / фичи: ${args.key_features || 'Премиальная натуральная кожа КРС, латунная прочная фурнитура, ручная обработка краев'}`;
              
              let descResponse;
              try {
                descResponse = await ai.models.generateContent({
                  model: activeModel,
                  contents: descPrompt,
                  config: {
                    systemInstruction: 'Ты ИИ-копирайтер брутального ателье кожи "Tak and Rat". Текст должен быть коротким (до 250 символов), харизматичным, без клише, подчеркивать честность материалов.',
                    temperature: 0.8
                  }
                });
              } catch (e) {
                console.warn(`[ADMIN AI AGENT] Ошибка копирайтинга с моделью ${activeModel}, пробуем фолбек...`);
                const fallbackRes = await executeWithFallback([descPrompt], {
                  systemInstruction: 'Ты ИИ-копирайтер брутального ателье кожи "Tak and Rat". Текст должен быть коротким (до 250 символов), харизматичным, без клише, подчеркивать честность материалов.',
                  temperature: 0.8
                });
                descResponse = fallbackRes.response;
              }
              result = { description: descResponse.text || "Ошибка генерации" };
            } else {
              result = { error: `Функция ${name} не поддерживается.` };
            }
          } catch (toolErr: any) {
            console.error(`[ADMIN AI AGENT] Ошибка выполнения инструмента ${name}:`, toolErr);
            result = { error: toolErr.message || 'Unknown tool execution error' };
          }

          toolResults.push({
            functionResponse: {
              name,
              response: result
            }
          });
        }

        // Записываем ход выполнения в историю диалога
        mappedContents.push({
          role: 'model',
          parts: response.candidates[0].content.parts
        });

        mappedContents.push({
          role: 'user',
          parts: toolResults
        });

        // Запрашиваем ответ с учетом результатов инструментов
        const nextStep = await executeWithFallback(mappedContents, {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: toolsList }],
          temperature: 0.7
        });
        response = nextStep.response;
        activeModel = nextStep.activeModel;

        functionCalls = response.functionCalls;
      }

      const finalReply = response.text || "ОПЕРАЦИЯ ЗАВЕРШЕНА: Брутальный ответ сформирован.";
      res.json({ reply: finalReply });
    } catch (error: any) {
      console.error(`[ADMIN AI AGENT] Критическая ошибка агента:`, error);
      res.status(500).json({ error: `TRINITY CORE CRITICAL ERROR: ${error.message}` });
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

    // В реальном приложении здесь должна быть проверка telegramId в БД на права админа
    if (!telegramId) {
      return res.status(401).json({ error: 'Unauthorized' });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
