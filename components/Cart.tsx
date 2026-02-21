
import React from 'react';
import { useStore } from '../store';

export const Cart: React.FC = () => {
  const { cart, updateQuantity, removeFromCart, setView } = useStore();
  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="p-8 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <h2 className="text-3xl font-bold uppercase mb-4">Ваша корзина пуста</h2>
        <button 
          onClick={() => setView('shop')}
          className="border-2 border-black px-8 py-3 font-bold uppercase hover:bg-black hover:text-white transition-all"
        >
          Вернуться в магазин
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto">
      {/* BACK BUTTON */}
      <button 
          onClick={() => setView('shop')}
          className="flex items-center gap-3 mb-10 cursor-pointer hover:opacity-60 transition-opacity"
      >
          <div className="w-8 h-8 border-2 border-black flex items-center justify-center bg-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </div>
          <span className="font-black uppercase tracking-[0.2em] text-xs">НА ГЛАВНУЮ</span>
      </button>

      <h2 className="text-5xl font-bold uppercase mb-12 tracking-tighter">Корзина</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          {cart.map(item => (
            <div key={`${item.id}-${item.selectedSize}`} className="flex gap-4 md:gap-6 p-4 md:p-6 border-2 border-black items-center bg-white">
              <div className="w-20 h-28 md:w-24 md:h-32 bg-[#f5f5f5] flex-shrink-0 border border-black/10">
                <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-grow">
                <h3 className="font-bold uppercase text-sm md:text-lg leading-tight">{item.name}</h3>
                <div className="flex flex-col md:flex-row gap-1 md:gap-4 text-[10px] font-bold mono uppercase opacity-50 mt-1">
                  <span>Размер: {item.selectedSize}</span>
                  <span>230г/м</span>
                </div>
                <p className="font-bold mt-2 text-lg md:text-xl mono">{item.price}₽</p>
              </div>
              <div className="flex flex-col items-end gap-4">
                <button 
                  onClick={() => removeFromCart(item.id, item.selectedSize)}
                  className="text-gray-300 hover:text-black transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
                <div className="flex items-center border-2 border-black bg-white">
                  <button 
                    onClick={() => updateQuantity(item.id, item.selectedSize, -1)}
                    className="px-2 md:px-3 py-1 hover:bg-black hover:text-white font-bold transition-colors"
                  >
                    -
                  </button>
                  <span className="px-3 md:px-4 font-bold mono border-x-2 border-black text-sm">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.selectedSize, 1)}
                    className="px-2 md:px-3 py-1 hover:bg-black hover:text-white font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-8">
          <div className="p-8 border-2 border-black bg-white space-y-6">
            <h3 className="font-bold uppercase text-xl">Детали заказа</h3>
            
            <div className="space-y-3 text-xs font-bold mono uppercase">
              <div className="flex justify-between border-b border-black/10 pb-2">
                <span className="opacity-40">Доставка:</span>
                <span>Рассчитывается далее</span>
              </div>
              <div className="flex justify-between items-end pt-4">
                <span className="text-lg">Итого:</span>
                <span className="text-3xl font-bold">{total}₽</span>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => setView('checkout')}
                className="w-full bg-black text-white py-5 font-bold uppercase tracking-widest hover:bg-gray-900 transition-all flex justify-between px-6 items-center"
              >
                <span>К оформлению</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14m-7-7l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
