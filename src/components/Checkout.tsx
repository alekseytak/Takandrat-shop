import React from 'react';
import { useStore } from '@/store';

export const Checkout: React.FC = () => {
  const { cart, setView, clearCart } = useStore();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Заказ оформлен!');
    clearCart();
    setView('shop');
  };

  return (
    <div className="p-4 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-black uppercase mb-6">Оформление заказа</h2>
      <form onSubmit={handleCheckout} className="flex flex-col gap-4">
        <input required type="text" placeholder="Имя" className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        <input required type="email" placeholder="Email" className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        <input required type="text" placeholder="Адрес доставки" className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        
        <div className="mt-6 pt-6 border-t-2 border-brand-text flex justify-between items-center">
          <span className="font-black uppercase">К оплате:</span>
          <span className="text-xl font-black">{total}₽</span>
        </div>
        
        <button type="submit" className="w-full bg-brand-text text-brand-bg py-4 font-black uppercase tracking-widest mt-4 hover:opacity-90 transition-opacity">
          Оплатить
        </button>
      </form>
    </div>
  );
};
