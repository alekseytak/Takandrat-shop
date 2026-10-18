
import React from 'react';
import { BRAND_NAME, BRAND_DESCRIPTION } from '../constants';
import { useStore } from '@/store';
import { UI_TEXT } from '@/lib/i18n';

export const Hero: React.FC = () => {
  const { lang } = useStore();
  const t = UI_TEXT[lang];

  return (
    <section className="px-6 py-12 md:py-16 border-b-2 border-brand-text flex flex-col items-start overflow-hidden relative">
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="inline-block bg-brand-text text-brand-bg text-[9px] md:text-[10px] font-black px-3 py-1 mb-8 md:mb-12 tracking-[0.2em] uppercase">
          {t.heroBadge}
        </div>
        
        <h1 className="text-[12vw] md:text-[10rem] font-black uppercase leading-[0.85] tracking-tighter mb-8 md:mb-12 break-words text-brand-text">
          {lang === 'en' ? t.brandName : BRAND_NAME}
        </h1>
        
        <p className="text-xl md:text-4xl font-black uppercase leading-[1.1] max-w-3xl tracking-tighter mb-16 text-brand-text">
          {lang === 'en' ? t.brandSubtitle : BRAND_DESCRIPTION}
        </p>
        
        <div className="w-full space-y-0 border-t-2 border-brand-text font-bold uppercase text-[10px] md:text-sm">
          <div className="flex justify-between py-4 border-b border-brand-text/30 items-center">
            <span className="opacity-50 uppercase">{t.heroRow1Label}</span>
            <span className="text-right">{t.heroRow1Value}</span>
          </div>
          <div className="flex justify-between py-4 border-b border-brand-text/30 items-center">
            <span className="opacity-50 uppercase">{t.heroRow2Label}</span>
            <span className="text-right">{t.heroRow2Value}</span>
          </div>
          <div className="flex justify-between py-4 border-b border-brand-text/30 items-center">
            <span className="opacity-50 uppercase">{t.heroRow3Label}</span>
            <span className="text-right">{t.heroRow3Value}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
