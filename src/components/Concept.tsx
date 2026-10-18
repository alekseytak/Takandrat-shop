import React from 'react';
import { CONCEPT_TITLE, CONCEPT_TEXT } from '../constants';
import { useStore } from '@/store';
import { UI_TEXT } from '@/lib/i18n';

export const Concept: React.FC = () => {
  const { lang } = useStore();
  const t = UI_TEXT[lang];
  const items = lang === 'en' ? t.conceptItems : CONCEPT_TEXT;

  return (
    <section className="bg-brand-bg border-t-2 border-brand-text overflow-hidden transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        {/* Уменьшенный заголовок */}
        <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight tracking-tighter mb-16 text-brand-text">
          {lang === 'en' ? t.conceptTitle : CONCEPT_TITLE}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 border-t border-brand-text/20 pt-10">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="mono text-[9px] font-black opacity-40">SYSTEM_0{idx + 1}</span>
                <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-brand-text">
                  {item.title}
                </h3>
              </div>
              <p className="text-[11px] md:text-xs font-bold uppercase opacity-60 leading-normal text-brand-text max-w-xs">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 p-8 md:p-12 border-2 border-brand-text brutalist-shadow bg-brand-bg relative group">
          <div className="relative z-10">
            <h4 className="text-xl md:text-3xl font-black uppercase tracking-tighter leading-none mb-4">
              {t.philosophyTitle}
            </h4>
            <p className="text-[10px] md:text-sm font-bold uppercase opacity-70 max-w-xl leading-tight">
              {t.philosophyBody}
            </p>
          </div>
          {/* Маленький акцент вместо огромного лого */}
          <div className="absolute top-4 right-4 mono text-[8px] opacity-20 group-hover:opacity-100 transition-opacity uppercase font-black">
            {t.protocolActive}
          </div>
        </div>
      </div>
    </section>
  );
};