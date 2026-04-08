
import React from 'react';

export const AILogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      {/* 
        === ПРИЧЕСКА === 
        Сплошная черная заливка. Исправлен синтаксис (удалены комментарии из d).
      */}
      <path 
        d="M 26 58 C 16 50 10 35 20 20 C 35 8 60 5 80 12 C 95 18 92 32 82 40 C 90 32 95 22 88 15 C 65 10 40 15 26 58 Z" 
        fill="currentColor" 
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Дополнительный объем/завиток спереди (чуб) */}
      <path 
        d="M 60 12 C 75 10 88 15 85 28 C 82 35 75 35 70 32" 
        fill="currentColor" 
        stroke="none"
      />

      {/* === ЛИЦО (Контур) === */}
      {/* Линия от виска вниз к подбородку и щеке */}
      <path d="M 28 62 C 28 82 48 92 68 85 C 80 80 82 65 78 55" />

      {/* === УХО === */}
      <path d="M 28 62 C 16 62 16 78 28 78" />
      <path d="M 22 68 Q 25 70 22 74" strokeWidth="2.5" />

      {/* === ГЛАЗА (Классические овалы) === */}
      {/* Левый */}
      <ellipse cx="48" cy="55" rx="5" ry="9" fill="currentColor" stroke="none" transform="rotate(-5 48 55)" />
      {/* Правый */}
      <ellipse cx="68" cy="52" rx="5" ry="9" fill="currentColor" stroke="none" transform="rotate(-5 68 52)" />
      
      {/* Блики (вырезы) для живости */}
      <circle cx="50" cy="51" r="2" fill="white" stroke="none" />
      <circle cx="70" cy="48" r="2" fill="white" stroke="none" />

      {/* === БРОВИ === */}
      <path d="M 45 40 Q 48 35 54 40" strokeWidth="3" />
      <path d="M 64 38 Q 68 34 74 38" strokeWidth="3" />

      {/* === НОС === */}
      <path d="M 62 60 Q 65 64 70 60" strokeWidth="3" />

      {/* === РОТ (Улыбка) === */}
      {/* Заливка рта */}
      <path d="M 58 72 Q 65 82 76 72" fill="currentColor" stroke="none" /> 
      {/* Контур нижней губы */}
      <path d="M 58 72 Q 65 82 76 72" fill="none" strokeWidth="2.5" />
      {/* Язык */}
      <path d="M 64 77 Q 67 75 70 77" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {/* Уголки рта */}
      <path d="M 56 71 L 58 72" strokeWidth="2.5" />
      <path d="M 76 72 L 78 71" strokeWidth="2.5" />

      {/* === ВЕСНУШКИ === */}
      <circle cx="40" cy="70" r="1" fill="currentColor" stroke="none" />
      <circle cx="44" cy="72" r="1" fill="currentColor" stroke="none" />
      <circle cx="38" cy="74" r="1" fill="currentColor" stroke="none" />

    </svg>
  );
};
