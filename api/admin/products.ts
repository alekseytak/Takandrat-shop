import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_supabaseAdmin.js';

const supabase = getSupabaseAdmin();

/**
 * Владельцы магазина: ADMIN_TELEGRAM_IDS, а если он пуст — TELEGRAM_ADMIN_CHAT_ID.
 * Та же логика, что в Edge Function admin-ai/admin.ts. На боевом Vercel задан
 * только TELEGRAM_ADMIN_CHAT_ID, поэтому без этого фолбэка админские маршруты
 * отказывали бы владельцу.
 */
function adminIds(): string[] {
  const explicit = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (explicit.length > 0) return explicit;
  return (process.env.TELEGRAM_ADMIN_CHAT_ID || '').split(',').map((id) => id.trim()).filter(Boolean);
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, price, description, image_url, category, stock_quantity } = req.body || {};
  const telegramId = (req.headers['x-telegram-id'] as string) || '';

  const allowedIds = adminIds();
  if (!allowedIds.includes(telegramId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .insert([{ name, price, description, image_url, category, stock_quantity, is_visible: true }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
