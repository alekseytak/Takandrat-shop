import React from 'react';
import { useStore } from '@/store';
import { UI_TEXT, getProductName, getProductPrice, formatMoney } from '@/lib/i18n';

export const Cart: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, setView, lang, currency } = useStore();
  const t = UI_TEXT[lang];

  const total = cart.reduce((sum, item) => sum + getProductPrice(item, currency) * item.quantity, 0);

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <h2 className="text-2xl font-black uppercase mb-6">{t.cartTitle}</h2>
      {cart.length === 0 ? (
        <p className="text-sm font-bold uppercase opacity-60">{t.cartEmpty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {cart.map((item) => (
            <div key={`${item.id}-${item.selectedSize}`} className="flex items-center justify-between border-2 border-brand-text p-4">
              <div>
                <h3 className="font-black uppercase">{getProductName(item, lang)}</h3>
                <p className="text-xs font-bold opacity-60">{t.sizeLabel}: {item.selectedSize}</p>
                <p className="text-sm font-bold">{formatMoney(getProductPrice(item, currency), currency)}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center border-2 border-brand-text">
                  <button onClick={() => updateQuantity(item.id, item.selectedSize, -1)} className="px-3 py-1 hover:bg-brand-text hover:text-brand-bg transition-colors">-</button>
                  <span className="px-3 font-bold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.selectedSize, 1)} className="px-3 py-1 hover:bg-brand-text hover:text-brand-bg transition-colors">+</button>
                </div>
                <button onClick={() => removeFromCart(item.id, item.selectedSize)} className="text-red-500 font-bold uppercase text-xs hover:underline">{t.removeBtn}</button>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center mt-6 pt-6 border-t-2 border-brand-text">
            <span className="text-xl font-black uppercase">{t.totalLabel}</span>
            <span className="text-2xl font-black">{formatMoney(total, currency)}</span>
          </div>
          <button onClick={() => setView('checkout')} className="w-full bg-brand-text text-brand-bg py-4 font-black uppercase tracking-widest mt-4 hover:opacity-90 transition-opacity">
            {t.checkoutBtn}
          </button>
        </div>
      )}
    </div>
  );
};
