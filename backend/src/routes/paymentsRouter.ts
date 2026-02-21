
import express, { Router } from 'express';
import { YooKassa } from 'yookassa-sdk';
import { supabase } from '../db/supabaseClient';

const router = Router();

// Инициализация SDK ЮКассы
// Убедитесь, что ENV переменные установлены в Render/Server
const yookassa = new (YooKassa as any)({
  shop_id: process.env.YOOKASSA_SHOP_ID!,
  secret_key: process.env.YOOKASSA_API_KEY!,
});

// CREATE PAYMENT
// POST /api/payments/create
router.post('/create', async (req, res) => {
  try {
    const { orderId, amount, description } = req.body;

    if (!orderId || !amount) {
       return res.status(400).json({ error: 'Missing orderId or amount' });
    }

    // Создаем платеж в ЮКассе
    const payment = await yookassa.createPayment({
      amount: {
        value: amount.toString(),
        currency: 'RUB',
      },
      payment_method_data: {
        type: 'bank_card',
      },
      confirmation: {
        type: 'redirect',
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?payment_success=true&orderId=${orderId}`,
      },
      description: description || `Order ${orderId}`,
      metadata: {
        order_id: orderId.toString(),
      },
      capture: true 
    });

    // Сохраняем информацию о платеже в нашу БД
    const { error } = await supabase.from('payments').insert({
      order_id: orderId,
      yookassa_payment_id: payment.id,
      amount,
      status: 'pending',
    });

    if (error) {
        console.error('DB Insert Error:', error);
        // Не блокируем ответ, если запись в БД упала, но платеж создан, 
        // но в проде лучше откатить.
    }

    res.json({
      paymentId: payment.id,
      confirmationUrl: (payment.confirmation as any).confirmation_url,
    });
  } catch (error: any) {
    console.error('Yookassa Create Error:', error);
    res.status(500).json({ error: 'Payment creation failed', details: error.message });
  }
});

// WEBHOOK HANDLER
// POST /api/payments/webhook
router.post('/webhook', express.raw({ type: 'application/json' }) as any, async (req, res) => {
  try {
    // Если body приходит как буфер или строка, парсим
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (event.type === 'payment.succeeded') {
      const paymentId = event.object.id;

      // Update payment status
      await supabase
        .from('payments')
        .update({ status: 'paid', webhook_received: true })
        .eq('yookassa_payment_id', paymentId);

      // Получаем order_id из таблицы payments, чтобы обновить orders
      const { data: payment } = await supabase
        .from('payments')
        .select('order_id')
        .eq('yookassa_payment_id', paymentId)
        .single();

      if (payment) {
        // Update order status
        await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('id', payment.order_id);

        console.log(`✅ Payment confirmed for order ${payment.order_id}`);
      }
    }

    // Всегда отвечаем 200 OK для вебхука
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export { router as paymentRouter };
