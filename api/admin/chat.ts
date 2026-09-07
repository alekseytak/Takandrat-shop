import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_supabaseAdmin';
const supabase = getSupabaseAdmin();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history, telegramId, attachments } = req.body || {};
  const telegramIdStr = String(telegramId ?? '');

  const allowedIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  const headerId = (req.headers['x-telegram-id'] as string) || '';
  if (!allowedIds.includes(headerId)) {
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

  const toolsList = [
    {
      name: 'list_products',
      description: 'Получает полный список товаров из базы данных. Используется для инспекции склада или поиска ID товаров.',
      parameters: { type: 'OBJECT', properties: {} }
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
    const { GoogleGenAI } = await import('@google/genai');
    const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    const adminModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    async function executeWithFallback(contents: any[], config: any) {
      let lastError: any = null;
      for (const modelName of adminModels) {
        try {
          const res = await aiClient.models.generateContent({
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
        const { name } = call;
          const args: any = (call as any).args || {};
          const _args = (args as any) || {};
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
              descResponse = await aiClient.models.generateContent({
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

      mappedContents.push({
        role: 'model',
        parts: response.candidates?.[0]?.content?.parts || []
      });

      mappedContents.push({
        role: 'user',
        parts: toolResults
      });

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
}
