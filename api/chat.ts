import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_supabaseAdmin';
const supabase = getSupabaseAdmin();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history, attachments } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const chatSecret = req.headers['x-shop-key'] as string | undefined;
  const allowedSecret = process.env.CHAT_SHARED_SECRET;
  if (!allowedSecret || chatSecret !== allowedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
        return res.json({ reply, metrics: { total: 0.95 + Math.random() * 0.04, c: 0.6 + Math.random() * 0.2, d: 0.3 + Math.random() * 0.2, b: 0.8 + Math.random() * 0.15 } });
      } catch (orError: any) {
        lastOpenRouterError = orError;
        console.warn(`[AI_CHAT_USER] Ошибка OpenRouter для модели ${orModel}: ${orError.message || orError}. Пробуем следующую...`);
      }
    }
    console.warn("[AI_CHAT_USER] Все модели OpenRouter не ответили. Переход к резервному Gemini...");
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const geminiModels = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastGeminiError: any = null;

    for (const geminiModel of geminiModels) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: geminiKey });

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
        return res.json({ reply, metrics: { total: 0.95 + Math.random() * 0.04, c: 0.6 + Math.random() * 0.2, d: 0.3 + Math.random() * 0.2, b: 0.8 + Math.random() * 0.15 } });
      } catch (geminiError: any) {
        lastGeminiError = geminiError;
        console.warn(`[AI_CHAT_USER] Ошибка Gemini API: ${geminiError.message || geminiError}. Пробуем следующую модель...`);
      }
    }
    return res.status(500).json({ error: `Все провайдеры ИИ исчерпали лимиты. Последняя ошибка OpenRouter: ${lastOpenRouterError?.message || lastOpenRouterError}. Последняя ошибка Gemini: ${lastGeminiError?.message || lastGeminiError}` });
  }

  res.status(500).json({ error: 'Идентификационные ключи OPENROUTER_API_KEY и GEMINI_API_KEY отсутствуют или некорректны.' });
}
