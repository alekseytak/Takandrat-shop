
import React, { useState } from 'react';
import { useStore } from '../store';

const SECTORS = [
  { id: 'rest', name: 'Рестораны / Бары', code: '01' },
  { id: 'coffee', name: 'Кофейни / Пекарни', code: '02' },
  { id: 'flowers', name: 'Цветочные лавки', code: '03' },
  { id: 'work', name: 'Мастерские / Арт', code: '04' }
];

export const CorporatePage: React.FC = () => {
  const { setView } = useStore();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Имитация отправки на сервер
    await new Promise(r => setTimeout(r, 1500));
    
    setIsLoading(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="p-12 text-center bg-brand-bg min-h-[70vh] flex flex-col justify-center items-center">
        <div className="w-24 h-24 border-4 border-brand-text rounded-full flex items-center justify-center mb-8 bg-brand-text text-brand-bg animate-in zoom-in duration-500">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
            <path d="M20 6L9 17L4 12" />
          </svg>
        </div>
        <h2 className="text-4xl md:text-6xl font-black uppercase mb-4 tracking-tighter">ПРОТОКОЛ ПРИНЯТ</h2>
        <p className="text-xl max-w-md font-bold uppercase opacity-60 mb-12">МЕНЕДЖЕР СВЯЖЕТСЯ С ВАМИ ДЛЯ ОБСУЖДЕНИЯ ТИРАЖА И ТЕХЗАДАНИЯ.</p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button 
            onClick={() => setIsSubmitted(false)}
            className="border-2 border-brand-text bg-brand-text text-brand-bg px-12 py-4 font-black uppercase hover:opacity-80 transition-all brutalist-shadow"
          >
            НОВЫЙ ЗАПРОС
          </button>
          <button 
            onClick={() => setView('shop')}
            className="text-[10px] font-black uppercase underline tracking-widest opacity-50 hover:opacity-100 transition-opacity"
          >
            В КАТАЛОГ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-bg transition-colors duration-300">
      <div className="px-6 pt-6">
        <button 
            onClick={() => setView('shop')}
            className="group flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity"
        >
            <div className="w-8 h-8 border-2 border-brand-text flex items-center justify-center bg-brand-bg group-hover:bg-brand-text group-hover:text-brand-bg transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </div>
            <span className="font-black uppercase tracking-[0.2em] text-[10px]">НА ГЛАВНУЮ</span>
        </button>
      </div>

      <section className="px-6 py-12 md:py-24 border-b-2 border-brand-text">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-[12vw] md:text-[10rem] font-black uppercase mb-10 tracking-tighter leading-[0.85]">
            PRODUCTION<br/>FOR B2B
          </h1>
          <p className="text-lg md:text-4xl max-w-4xl font-black uppercase leading-tight mb-20 tracking-tighter">
            РАЗРАБАТЫВАЕМ И ШЬЕМ ПРЕМИАЛЬНЫЙ МЕРЧ ОТ 20 ЕДИНИЦ. ПОЛНЫЙ ЦИКЛ АВТОНОМНОГО ПРОИЗВОДСТВА.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-0 border-l-2 border-t-2 border-brand-text">
            {SECTORS.map(s => (
              <div key={s.id} className="border-r-2 border-b-2 border-brand-text p-10 bg-brand-bg/60 hover:bg-brand-text hover:text-brand-bg transition-all flex flex-col items-start text-left group min-h-[220px]">
                <span className="mono text-[10px] font-black mb-12 opacity-30 group-hover:opacity-100 tracking-widest">{s.code}</span>
                <h3 className="text-xl font-black uppercase leading-tight mt-auto">{s.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 border-b-2 border-brand-text">
        <div className="p-12 border-r-2 border-brand-text flex flex-col justify-center bg-brand-bg/40">
          <h2 className="text-4xl md:text-5xl font-black uppercase mb-12 tracking-tighter">УСЛОВИЯ</h2>
          <div className="space-y-12">
            {[
              { n: '01', t: 'МИНИМАЛЬНЫЙ ТИРАЖ', d: 'ОТ 20 ШТУК НА МОДЕЛЬ. ОПТИМАЛЬНО ДЛЯ ЛОКАЛЬНЫХ КОМАНД.' },
              { n: '02', t: 'КАСТОМИЗАЦИЯ', d: 'ВЫШИВКА, ШЕЛКОГРАФИЯ, ИНДИВИДУАЛЬНЫЕ ЛЕКАЛА И БИРКИ.' },
              { n: '03', t: 'ЛОГИСТИКА', d: 'ОТГРУЗКА ИЗ САНКТ-ПЕТЕРБУРГА ПО ВСЕМУ МИРУ.' }
            ].map(item => (
              <div key={item.n} className="flex gap-8 items-start">
                <span className="mono bg-brand-text text-brand-bg w-10 h-10 flex items-center justify-center font-black text-sm flex-shrink-0">{item.n}</span>
                <div>
                  <h4 className="font-black uppercase mb-3 text-lg">{item.t}</h4>
                  <p className="font-bold uppercase opacity-60 text-xs leading-relaxed">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-12 bg-brand-text/5 flex items-center justify-center">
          <div className="w-full max-w-xl p-10 bg-brand-bg border-2 border-brand-text brutalist-shadow">
            <h3 className="text-3xl font-black uppercase mb-10 tracking-tighter">ОСТАВИТЬ ЗАЯВКУ</h3>
            <form onSubmit={handleOrderSubmit} className="space-y-8">
              <div>
                <label className="block text-[10px] font-black uppercase mono mb-2 tracking-widest opacity-50">ИМЯ / ПРОЕКТ</label>
                <input required type="text" className="w-full border-2 border-brand-text p-5 bg-transparent outline-none focus:bg-brand-text/5 font-bold uppercase text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase mono mb-2 tracking-widest opacity-50">КОНТАКТЫ (TG/PHONE)</label>
                <input required type="text" className="w-full border-2 border-brand-text p-5 bg-transparent outline-none focus:bg-brand-text/5 font-bold uppercase text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase mono mb-2 tracking-widest opacity-50">ТЕХЗАДАНИЕ (КРАТКО)</label>
                <textarea rows={4} className="w-full border-2 border-brand-text p-5 bg-transparent outline-none focus:bg-brand-text/5 font-bold uppercase text-sm resize-none"></textarea>
              </div>
              <button 
                disabled={isLoading}
                className="w-full bg-brand-text text-brand-bg py-6 font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 border-2 border-brand-text"
              >
                {isLoading ? 'ОТПРАВКА...' : 'ОТПРАВИТЬ ЗАПРОС'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};
