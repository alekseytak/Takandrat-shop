
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { DeliveryDetails } from '../types';
import { adminService } from '../services/adminService';
import { paymentService } from '../services/paymentService';

export const Checkout: React.FC = () => {
  const { cart, clearCart, setView, currentUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);

  const [formData, setFormData] = useState<Omit<DeliveryDetails, 'paymentMethod'> & { paymentMethod: 'card' }>({
    fullName: '',
    phone: '',
    city: '',
    address: '',
    comment: '',
    paymentMethod: 'card'
  });

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !consent) return;
    
    setLoading(true);
    setError('');

    try {
      const orderPayload = {
        telegram_id: currentUser?.telegram_id,
        customer_name: formData.fullName,
        phone: formData.phone,
        address: `ПВЗ: ${formData.city}, ${formData.address}`,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price_cents: Math.round(item.price * 100)
        })),
        consent: true
      };

      const { order_id } = await adminService.createOrder(orderPayload);
      
      try {
        const paymentResponse = await paymentService.createPayment(
          parseInt(order_id) || 0,
          total, 
          `Ателье Кожи: Заказ #${order_id}`
        );
        if (paymentResponse.confirmationUrl) {
          window.location.href = paymentResponse.confirmationUrl;
          return;
        }
      } catch (payErr) {
        setSuccess(true);
        clearCart();
      }
    } catch (err: any) {
      setError('ОШИБКА: ПРОВЕРЬТЕ СОЕДИНЕНИЕ И ДАННЫЕ.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-12 min-h-[60vh] flex flex-col items-center justify-center text-center bg-brand-bg transition-colors duration-300">
        <div className="w-20 h-20 border-4 border-brand-text rounded-full flex items-center justify-center mb-8 bg-green-500 text-brand-bg">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17L4 12"/></svg>
        </div>
        <h2 className="text-4xl md:text-6xl font-black uppercase mb-6 tracking-tighter text-brand-text">ЗАКАЗ В РАБОТЕ</h2>
        <p className="text-lg font-bold uppercase opacity-60 max-w-lg mb-12 text-brand-text">
          ДАННЫЕ БУДУТ УДАЛЕНЫ ЧЕРЕЗ 72 ЧАСА ПОСЛЕ ДОСТАВКИ. (ФЗ-152)
        </p>
        <button onClick={() => setView('shop')} className="bg-brand-text text-brand-bg px-12 py-4 font-black uppercase tracking-widest hover:opacity-80 transition-all border-2 border-brand-text brutalist-shadow">
          НА ГЛАВНУЮ
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 bg-brand-bg transition-colors duration-300">
      <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-12 text-brand-text">ОФОРМЛЕНИЕ</h2>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="space-y-6">
            <h3 className="font-black uppercase text-lg border-b-2 border-brand-text pb-2 text-brand-text">01. ПОЛУЧАТЕЛЬ</h3>
            <input name="fullName" placeholder="ФИО ПОЛУЧАТЕЛЯ" required value={formData.fullName} onChange={handleChange} className="w-full border-2 border-brand-text p-4 bg-transparent font-bold uppercase outline-none focus:bg-brand-text/5 text-brand-text text-xs" />
            <input name="phone" placeholder="ТЕЛЕФОН" required type="tel" value={formData.phone} onChange={handleChange} className="w-full border-2 border-brand-text p-4 bg-transparent font-bold uppercase outline-none focus:bg-brand-text/5 text-brand-text text-xs" />
          </div>

          <div className="space-y-6">
            <h3 className="font-black uppercase text-lg border-b-2 border-brand-text pb-2 text-brand-text">02. ДОСТАВКА (ПВЗ)</h3>
            <input name="city" placeholder="ГОРОД" required value={formData.city} onChange={handleChange} className="w-full border-2 border-brand-text p-4 bg-transparent font-bold uppercase outline-none focus:bg-brand-text/5 text-brand-text text-xs" />
            <input name="address" placeholder="АДРЕС ПВЗ (ЯНДЕКС/ОЗОН/СДЭК)" required value={formData.address} onChange={handleChange} className="w-full border-2 border-brand-text p-4 bg-transparent font-bold uppercase outline-none focus:bg-brand-text/5 text-brand-text text-xs" />
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-4 h-4 accent-brand-text border-2 border-brand-text" />
              <span className="text-[10px] font-bold uppercase leading-tight text-brand-text opacity-70">
                Я СОГЛАСЕН НА ОБРАБОТКУ АДРЕСА ПВЗ. ДАННЫЕ УДАЛЯЮТСЯ ЧЕРЕЗ 72 ЧАСА ПОСЛЕ ВРУЧЕНИЯ.
              </span>
            </label>
          </div>

          <button type="submit" disabled={!consent} className="w-full bg-brand-text text-brand-bg py-6 font-black uppercase tracking-widest text-lg border-2 border-brand-text brutalist-shadow">
            ОПЛАТИТЬ {total}₽
          </button>
        </div>

        <div className="border-2 border-brand-text p-8 bg-brand-bg/50">
           <h3 className="font-black uppercase text-xl mb-6 text-brand-text">ИТОГО</h3>
           <div className="text-4xl font-black text-brand-text mb-4">{total}₽</div>
           <p className="text-[10px] font-bold uppercase opacity-50">БЕЗОПАСНАЯ ОПЛАТА КАРТОЙ РФ</p>
        </div>
      </form>
    </div>
  );
};
