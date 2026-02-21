
import React from 'react';
import { useStore } from '../store';

export const InfoPage: React.FC = () => {
  const { setView } = useStore();

  const sections = [
    {
      title: "PROTOCOL 01: LOGISTICS",
      subtitle: "ДОСТАВКА И ОТПРАВКА",
      content: [
        "Доставка осуществляется сервисом Yandex Go / CDEK по всей России.",
        "Отправка заказов: ПН, СР, ПТ до 18:00.",
        "Стоимость рассчитывается автоматически при оформлении.",
        "Трек-номер отправляется в Telegram после передачи курьеру."
      ]
    },
    {
      title: "PROTOCOL 02: PAYMENT",
      subtitle: "ОПЛАТА",
      content: [
        "Банковские карты РФ (через шлюз YooKassa).",
        "Система работает по 100% предоплате для обеспечения скорости отгрузки.",
        "Электронный чек отправляется на email после успешной транзакции."
      ]
    },
    {
      title: "PROTOCOL 03: RETURNS",
      subtitle: "ВОЗВРАТ И ОБМЕН",
      content: [
        "Возврат возможен в течение 14 дней с момента получения.",
        "Изделие не должно иметь следов эксплуатации (стирка, носка, запахи).",
        "Бирки и упаковка должны быть сохранены.",
        "Расходы на обратную логистику несет покупатель, если нет брака."
      ]
    },
    {
      title: "PROTOCOL 04: MAINTENANCE",
      subtitle: "УХОД ЗА ИЗДЕЛИЯМИ",
      content: [
        "Стирка: 30°C, деликатный режим.",
        "Отжим: не более 600 оборотов.",
        "Не использовать отбеливатели.",
        "Сушить в расправленном виде. Кожу — только естественная сушка."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-12 pb-32">
      <div className="max-w-4xl mx-auto">
        {/* BACK BUTTON */}
        <button 
          onClick={() => setView('shop')}
          className="group flex items-center gap-3 mb-12 cursor-pointer hover:opacity-70 transition-opacity"
        >
          <div className="w-10 h-10 border-2 border-black flex items-center justify-center bg-white group-hover:bg-black group-hover:text-white transition-colors">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </div>
          <span className="font-black uppercase tracking-[0.2em] text-sm">НА ГЛАВНУЮ</span>
        </button>

        <h1 className="text-[12vw] md:text-8xl font-black uppercase tracking-tighter leading-[0.8] mb-16">
          SYSTEM<br/>INFO
        </h1>

        <div className="space-y-12">
          {sections.map((sec, idx) => (
            <div key={idx} className="border-t-4 border-black pt-6 bg-white/40 p-6 backdrop-blur-sm">
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2 flex gap-4">
                <span className="opacity-30 mono">0{idx + 1} //</span>
                {sec.title}
              </h2>
              <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-6 ml-14">{sec.subtitle}</p>
              <ul className="space-y-4 ml-2 md:ml-14">
                {sec.content.map((line, i) => (
                  <li key={i} className="flex gap-4 items-start font-bold uppercase text-xs md:text-sm leading-relaxed">
                    <span className="w-1.5 h-1.5 bg-black mt-1.5 flex-shrink-0"></span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-20 p-8 border-2 border-black bg-white/80 backdrop-blur-md brutalist-shadow">
          <h3 className="font-black uppercase text-xl mb-4">CONTACT SUPPORT</h3>
          <p className="font-bold uppercase text-sm opacity-60 mb-6">
            Если возникла нештатная ситуация, свяжитесь с оператором напрямую.
          </p>
          <a href="#" className="inline-block w-full md:w-auto bg-black text-white px-8 py-4 font-black uppercase text-xs tracking-widest hover:bg-white hover:text-black border-2 border-black transition-colors text-center">
            OPEN TELEGRAM CHAT
          </a>
        </div>
      </div>
    </div>
  );
};
