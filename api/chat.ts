import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bestEffort, type ChatMessage } from './_lib/llm.js';
import { clientAssistantPrompt } from './_lib/shopPrompt.js';

/**
 * Публичный ассистент магазина (Vercel).
 *
 * Читает каталог анонимным ключом — RLS отдаёт только видимые товары. Текст
 * генерирует OpenRouter (первым) или LiteRouter (запасным). Gemini выпилен.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xxkafurxhvcclwzabawm.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4a2FmdXJ4aHZjY2x3emFiYXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTgxMTIsImV4cCI6MjA4NDczNDExMn0.WX3hF0mf6fFpaVIGWFwthmJgoLO4dSkPZH4L_sgOGpc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history, attachments } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const { data: liveProducts } = await supabase
    .from('products')
    .select('id, name, price, description, stock_quantity')
    .eq('is_visible', true)
    .order('id', { ascending: true });
  const inventory = (liveProducts || []).map((p: any) =>
    `[PRODUCT:${p.id}] ${p.name} (${p.price} руб., остаток: ${p.stock_quantity ?? 'уточнить'}): ${p.description || ''}`
  ).join('\n') || 'Каталог временно недоступен. Не выдумывай товары, цены и наличие.';

  const systemPrompt = clientAssistantPrompt(inventory);

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
    res.json({ reply: content || 'COMM_LINK_ERROR' });
  } catch (error: any) {
    console.error('[AI_CHAT_USER]', error?.message || error);
    res.status(500).json({ error: error?.message || 'Все LLM-провайдеры недоступны.' });
  }
}
