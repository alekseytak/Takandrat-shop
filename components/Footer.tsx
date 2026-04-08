import React, { useState } from 'react';
import { BRAND_NAME } from '../constants';

type ModalType = 'delivery' | 'payment' | 'return' | 'contacts' | 'donation' | 'legal' | null;

export const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const modalData = {
    delivery: {
      title: "ДОСТАВКА",
      lines: [
        "Доставка по всей России.",
        "Партнеры: CDEK, Yandex Delivery, Почта РФ.",
        "Срок обработки: 1-2 рабочих дня.",
        "Трек-номер в Telegram после отправки."
      ]
    },
    payment: {
      title: "ОПЛАТА",
      lines: [
        "Банковские карты РФ через ЮKassa.",
        "Безопасная оплата согласно ФЗ-422 (Налог на проф. доход).",
        "Автоматическая выдача электронного чека."
      ]
    },
    return: {
      title: "ВОЗВРАТ",
      lines: [
        "14 дней на возврат товара надлежащего качества.",
        "Изделия по спец. заказу возврату не подлежат.",
        "Товар должен быть в заводском состоянии."
      ]
    },
    contacts: {
      title: "СВЯЗЬ",
      lines: [
        "Telegram: @takandrat_bot",
        "Instagram: @takandrat",
        "Support: support@takandrat.com"
      ]
    },
    donation: {
      title: "SUPPORT",
      lines: [
        "Развитие автономного производства.",
        "USDT (TRC-20): TQn9Y2khSsh...xYz",
        "BTC: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
      ]
    },
    legal: {
      title: "ЮРИДИЧЕСКИЙ ПРОТОКОЛ",
      lines: [
        "Проект 'tak and rat' управляется самозанятым лицом.",
        "ФЗ-422: Все транзакции регистрируются в ФНС.",
        "ФЗ-152: Мы собираем только данные, необходимые для доставки.",
        "Авто-удаление ПДн: Ваши данные стираются через 72 часа после доставки."
      ]
    }
  };

  const closeModal = () => setActiveModal(null);

  return (
    <>
      <footer className="bg-brand-bg border-t-2 border-brand-text p-8 md:p-16 pb-24 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-10 md:gap-16">
          <div className="max-w-sm">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 leading-none text-brand-text">{BRAND_NAME}</h2>
            <p className="text-[10px] md:text-sm font-bold uppercase leading-tight opacity-40 text-brand-text">
              АТЕЛЬЕ КОЖИ И ТЕКСТИЛЯ. <br/>ИНСТРУМЕНТЫ ДЛЯ АВТОНОМНОСТИ.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-8 md:gap-16">
            <div className="space-y-4">
              <h4 className="font-black uppercase text-[10px] md:text-xs tracking-widest border-b border-brand-text pb-1 inline-block pr-6 text-brand-text">
                ИНФО
              </h4>
              <ul className="space-y-2 font-bold uppercase text-[9px] md:text-[10px] opacity-60 text-brand-text text-left">
                <li><button onClick={() => setActiveModal('delivery')} className="hover:underline">Доставка</button></li>
                <li><button onClick={() => setActiveModal('payment')} className="hover:underline">Оплата</button></li>
                <li><button onClick={() => setActiveModal('return')} className="hover:underline">Возврат</button></li>
                <li><button onClick={() => setActiveModal('legal')} className="hover:underline text-brand-text/30 italic">ФЗ-152 / ФЗ-422</button></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-black uppercase text-[10px] md:text-xs tracking-widest border-b border-brand-text pb-1 inline-block pr-6 text-brand-text">
                СЕТЬ
              </h4>
              <ul className="space-y-2 font-bold uppercase text-[9px] md:text-[10px] opacity-60 text-brand-text text-left">
                <li><a href="https://t.me/takandrat_bot" target="_blank" className="hover:underline">Telegram</a></li>
                <li><button onClick={() => setActiveModal('contacts')} className="hover:underline">Контакты</button></li>
                <li><button onClick={() => setActiveModal('donation')} className="hover:underline opacity-20">Donate</button></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pt-10 md:pt-14 mt-10 md:mt-14 border-t border-brand-text/5 text-[8px] md:text-[9px] font-black mono uppercase opacity-30 gap-4 text-center md:text-left text-brand-text">
          <div>© 2025 {BRAND_NAME} // САНКТ-ПЕТЕРБУРГ</div>
          <div className="flex gap-4 md:gap-8 flex-wrap justify-center">
            <span>Handmade Gear</span>
            <span>Compliance Active</span>
            <span>v.4.2</span>
          </div>
        </div>
      </footer>

      {activeModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={closeModal}>
          <div className="bg-brand-bg border-2 border-brand-text p-6 md:p-8 max-w-md w-full relative brutalist-shadow text-brand-text" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeModal} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-brand-text hover:bg-brand-text hover:text-brand-bg transition-colors">✕</button>
            <h3 className="text-xl md:text-2xl font-black uppercase mb-6 tracking-tight border-b-2 border-brand-text pb-4">{modalData[activeModal].title}</h3>
            <ul className="space-y-3">
              {modalData[activeModal].lines.map((line, idx) => (
                <li key={idx} className="flex gap-3 items-start text-[10px] md:text-xs font-bold uppercase leading-relaxed opacity-80">
                  <span className="w-1.5 h-1.5 bg-brand-text mt-1 flex-shrink-0"></span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
};