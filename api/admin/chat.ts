import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_supabaseAdmin';
import { bestEffort, type ChatMessage, type ToolDef } from '../_lib/llm';

const supabase = getSupabaseAdmin();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history, telegramId, attachments } = req.body || {};

  // Право админа проверяется по telegramId из тела (фронт шлёт именно так).
  const allowedIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!allowedIds.includes(String(telegramId ?? ''))) {
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
3. ОБНОВЛЕНИЕ ТОВАРА: При запросе изменить цену, название, описание или складские запасы, сначала уточни ID товара (можешь найти его через 'list_products') и примени 'update_product'.
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
      messages.push({ role: 'assistant', content: result.content, tool_calls: result.toolCalls });

      for (const call of result.toolCalls) {
        let args: any = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch { args = {}; }
        let toolResult: any;
        try {
          toolResult = await runTool(call.function.name, args);
        } catch (toolError: any) {
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
}
