import React from 'react';
import { useStore } from '@/store';
import { adminService } from '@/services/adminService';

export const Checkout: React.FC = () => {
  const { cart, setView, clearCart } = useStore();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const SOLANA_ADDRESS = '4QoVmYDgTAH99PVWT13e77FXnWxdSUkhd42bakeJ7zBA';

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    const telegramId = useStore.getState().currentUser?.telegram_id;

    try {
      const result = await adminService.createOrder({
        telegram_id: telegramId,
        customer_name: String(form.get('name') || ''),
        phone: String(form.get('phone') || form.get('email') || ''),
        address: String(form.get('address') || ''),
        items: cart.map(item => ({
          product_id: String(item.db_id ?? item.id),
          quantity: item.quantity,
          price_cents: Math.round(item.price * 100)
        }))
      });
      alert(`Заказ ${result.order_id} принят. Ожидайте подтверждения.`);
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
        <input required name="name" type="text" placeholder="Имя" className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        <input required name="phone" type="tel" placeholder="Телефон" className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        <input required name="email" type="email" placeholder="Email" className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        <input required name="address" type="text" placeholder="Адрес доставки" className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        
        <div className="mt-6 pt-6 border-t-2 border-brand-text flex justify-between items-center">
          <span className="font-black uppercase">К оплате:</span>
          <span className="text-xl font-black">{total}₽</span>
        </div>

        <div className="mt-8 p-4 border-2 border-brand-text bg-brand-text/5">
          <h3 className="font-black uppercase text-sm mb-4 tracking-widest">РЕКВИЗИТЫ SOLANA (TRINITY SECURE)</h3>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black opacity-50">SOLANA (SOL)</span>
            <div className="flex gap-2 items-center">
              <code className="bg-brand-text text-brand-bg px-2 py-1 text-[10px] break-all font-mono flex-1">{SOLANA_ADDRESS}</code>
              <button 
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SOLANA_ADDRESS);
                  alert(`Solana адрес скопирован`);
                }}
                className="bg-brand-text text-brand-bg p-2 hover:opacity-80 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
          <p className="mt-4 text-[9px] font-bold uppercase opacity-40 leading-tight">
            ПОСЛЕ ОПЛАТЫ ПРИШЛИТЕ СКРИНШОТ В ЧАТ ТРИНИТИ ДЛЯ ПОДТВЕРЖДЕНИЯ ТРАНЗАКЦИИ. ДАННЫЕ БУДУТ УДАЛЕНЫ ЧЕРЕЗ 72 ЧАСА.
          </p>
        </div>
        
        {error && <p role="alert" className="border-2 border-red-600 p-3 text-xs font-bold text-red-600">{error}</p>}
        <button disabled={isSubmitting} type="submit" className="w-full bg-brand-text text-brand-bg py-4 font-black uppercase tracking-widest mt-4 hover:opacity-90 transition-opacity disabled:opacity-50">
          {isSubmitting ? 'ОТПРАВКА...' : 'ПОДТВЕРДИТЬ ЗАКАЗ'}
        </button>
      </form>
    </div>
  );
};
