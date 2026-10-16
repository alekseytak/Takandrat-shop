import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Просмотр фотографий товара во весь экран.
 *
 * Зачем: раньше кадры можно было только перелистывать точками под картинкой —
 * по одной, вслепую и в размере карточки. На телефоне это почти не работало:
 * точки попадали под палец, а разглядеть шов на маленьком превью нельзя.
 * Теперь по нажатию на фотографию открывается просмотр, где кадр занимает
 * экран и листается стрелками, клавиатурой и свайпом.
 */
interface PhotoViewerProps {
  images: string[];
  alt: string;
  /** С какого кадра открылись. */
  startIndex: number;
  onClose: () => void;
}

export const PhotoViewer: React.FC<PhotoViewerProps> = ({ images, alt, startIndex, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);

  const count = images.length;
  const go = useCallback(
    (step: number) => setIndex((current) => (count === 0 ? 0 : (current + step + count) % count)),
    [count],
  );

  // Клавиатура: стрелки листают, Escape закрывает.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Пока просмотр открыт, страница под ним не прокручивается.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  if (count === 0) return null;

  return (
    <div
      data-photo-viewer="открыт"
      role="dialog"
      aria-modal="true"
      aria-label={`Просмотр фотографий: ${alt}`}
      className="fixed inset-0 z-[100] bg-brand-bg/98 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between border-b-2 border-brand-text px-4 py-3">
        <span data-photo-viewer-counter className="font-black uppercase tracking-widest text-[10px] md:text-xs">
          {index + 1} / {count}
        </span>
        <span className="font-black uppercase tracking-widest text-[10px] md:text-xs opacity-60 truncate px-4">
          {alt}
        </span>
        <button
          type="button"
          data-photo-viewer-close
          onClick={(event) => { event.stopPropagation(); onClose(); }}
          aria-label="Закрыть просмотр"
          className="border-2 border-brand-text px-3 py-1 font-black uppercase text-[10px] md:text-xs hover:bg-brand-text hover:text-brand-bg transition-colors"
        >
          Закрыть ✕
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden p-2 md:p-6"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX ?? null;
          if (start !== null && end !== null && Math.abs(end - start) > 40) go(end < start ? 1 : -1);
          touchStartX.current = null;
        }}
      >
        {count > 1 && (
          <button
            type="button"
            data-photo-viewer-prev
            onClick={() => go(-1)}
            aria-label="Предыдущий кадр"
            className="absolute left-1 md:left-6 z-10 border-2 border-brand-text bg-brand-bg/90 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center font-black hover:bg-brand-text hover:text-brand-bg transition-colors"
          >
            ←
          </button>
        )}

        <img
          data-photo-viewer-image
          src={images[index]}
          alt={`${alt} — кадр ${index + 1}`}
          className="max-h-full max-w-full object-contain border-2 border-brand-text bg-brand-text/5"
        />

        {count > 1 && (
          <button
            type="button"
            data-photo-viewer-next
            onClick={() => go(1)}
            aria-label="Следующий кадр"
            className="absolute right-1 md:right-6 z-10 border-2 border-brand-text bg-brand-bg/90 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center font-black hover:bg-brand-text hover:text-brand-bg transition-colors"
          >
            →
          </button>
        )}
      </div>

      {count > 1 && (
        <div
          className="border-t-2 border-brand-text px-2 py-2 flex gap-2 overflow-x-auto no-scrollbar"
          onClick={(event) => event.stopPropagation()}
        >
          {images.map((image, idx) => (
            <button
              type="button"
              key={image}
              data-photo-viewer-thumb={idx === index ? 'выбран' : 'нет'}
              onClick={() => setIndex(idx)}
              aria-label={`Кадр ${idx + 1}`}
              className={`w-14 h-14 md:w-20 md:h-20 flex-shrink-0 border-2 transition-all ${
                idx === index ? 'border-brand-text opacity-100' : 'border-brand-text/30 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={image} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
