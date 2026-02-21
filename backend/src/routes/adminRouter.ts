
import { Router, NextFunction } from 'express';
import { supabase } from '../db/supabaseClient';

const router = Router();

// Helper для парсинга query string от Telegram
const parseInitData = (initData: string) => {
  const q = new URLSearchParams(initData);
  const userStr = q.get('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
};

// Middleware: SECURITY CHECK
const requireAdmin = async (req: any, res: any, next: NextFunction) => {
  const initData = req.headers['x-telegram-init-data'] as string;
  const headerId = req.headers['x-telegram-id'] as string;
  
  let telegramId: string | undefined;

  // 1. Приоритет: Пытаемся достать ID из безопасной строки initData
  if (initData) {
      const user = parseInitData(initData);
      if (user && user.id) {
          telegramId = user.id.toString();
          // TODO: В продакшене здесь нужно добавить валидацию HMAC-SHA256 подписи
      }
  }

  // 2. Фоллбэк: Если initData нет
  if (!telegramId && headerId) {
      telegramId = headerId;
  }
  
  if (!telegramId) {
    return res.status(401).json({ error: 'Unauthorized: Missing Identity' });
  }

  try {
    // 3. Главная проверка: Смотрим в БД, является ли этот ID админом
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !data || !data.is_admin) {
      console.warn(`Admin access denied for ID: ${telegramId}`);
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Проверка пройдена
    next();
  } catch (err) {
    console.error('Admin Check Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// GET /api/admin/orders - Все заказы
router.get('/orders', requireAdmin, async (req: any, res: any) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/admin/orders/:id/status - Обновить статус заказа
router.put('/orders/:id/status', requireAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const { status } = req.body;

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/admin/products - Все продукты
router.get('/products', requireAdmin, async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });
  
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/admin/products - Создать новый продукт
router.post('/products', requireAdmin, async (req: any, res: any) => {
    const { name, price, description, image_url, category, stock_quantity } = req.body;
    
    const { data, error } = await supabase
        .from('products')
        .insert([{
            name, 
            price, 
            description, 
            image_url, 
            category, 
            stock_quantity: stock_quantity || 100,
            is_visible: true
        }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// PUT /api/admin/products/:id/toggle - Скрыть/Показать продукт
router.put('/products/:id/toggle', requireAdmin, async (req: any, res: any) => {
    const { id } = req.params;
    const { is_visible } = req.body;
  
    const { data, error } = await supabase
      .from('products')
      .update({ is_visible })
      .eq('id', id)
      .select();
  
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// DELETE /api/admin/products/:id - Удалить продукт
router.delete('/products/:id', requireAdmin, async (req: any, res: any) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

export { router as adminRouter };
