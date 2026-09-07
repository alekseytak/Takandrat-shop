import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_supabaseAdmin';
const supabase = getSupabaseAdmin();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, price, description, image_url, category, stock_quantity } = req.body || {};
  const telegramId = (req.headers['x-telegram-id'] as string) || '';

  const allowedIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  if (!allowedIds.includes(telegramId)) {
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
}
