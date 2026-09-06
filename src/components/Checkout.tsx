import React from 'react';
import { useStore } from '@/store';
import { adminService } from '@/services/adminService';

type PaymentDetails = { card: string | null; cardRecipient: string | null; crypto: string | null; cryptoNetwork: string | null };

export const Checkout: React.FC = () => {
  const { cart, setView, clearCart } = useStore();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const [payment, setPayment] = React.useState<PaymentDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/payment-details')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('PAYMENT_DETAILS_UNAVAILABLE')))
      .then(setPayment)
      .catch(() => setPayment({ card: null, cardRecipient: null, crypto: null, cryptoNetwork: null }));
  }, []);

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    const telegramId = useStore.getState().currentUser?.telegram_id;
    try {
      const result = await adminService.createOrder({
        telegram_id: telegramId,
        customer_name: useStore.getState().currentUser?.first_name || 'Покупатель Telegram',
        phone: '',
        address: String(form.get('address') || ''),
        items: cart.map(item => ({ product_id: String(item.db_id ?? item.id), quantity: item.quantity, price_cents: Math.round(item.price * 100) }))
      });
      alert(`Заказ ${result.order_id} принят. Переведите оплату и пришлите подтверждение в Telegram.`);
      clearCart();
      setView('shop');
    } catch (err: any) {
      setError(err?.message || 'Не удалось оформить заказ. Попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-black uppercase mb-6">Оформление заказа</h2>
      <form onSubmit={handleCheckout} className="flex flex-col gap-4">
        <input required name="address" type="text" placeholder="Адрес ПВЗ (Яндекс / Ozon / СДЭК)" className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        <div className="mt-6 pt-6 border-t-2 border-brand-text flex justify-between items-center"><span className="font-black uppercase">К оплате:</span><span className="text-xl font-black">{total}₽</span></div>
        <div className="mt-8 p-4 border-2 border-brand-text bg-brand-text/5">
          <h3 className="font-black uppercase text-sm mb-4 tracking-widest">ОПЛАТА ПЕРЕВОДОМ</h3>
          {payment?.card ? <p className="text-sm font-black">КАРТА: {payment.card}</p> : <p className="text-xs font-bold opacity-60">РЕКВИЗИТЫ КАРТЫ НЕ НАСТРОЕНЫ</p>}
          {payment?.cardRecipient && <p className="text-xs font-bold mt-1">Получатель: {payment.cardRecipient}</p>}
          {payment?.crypto && <p className="text-xs font-bold mt-3 break-all">КРИПТО: {payment.crypto}{payment.cryptoNetwork ? ` (${payment.cryptoNetwork})` : ''}</p>}
          <p className="mt-4 text-[9px] font-bold uppercase opacity-60 leading-tight">После оплаты пришлите подтверждение в Telegram. Данные заказа содержат только Telegram ID и адрес ПВЗ.</p>
        </div>
        {error && <p role="alert" className="border-2 border-red-600 p-3 text-xs font-bold text-red-600">{error}</p>}
        <button disabled={isSubmitting} type="submit" className="w-full bg-brand-text text-brand-bg py-4 font-black uppercase tracking-widest mt-4 hover:opacity-90 transition-opacity disabled:opacity-50">{isSubmitting ? 'ОТПРАВКА...' : 'ПОДТВЕРДИТЬ ЗАКАЗ'}</button>
      </form>
    </div>
  );
};
