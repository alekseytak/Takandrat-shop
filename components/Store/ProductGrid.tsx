
import React, { useState, useMemo } from 'react';
import { useProductFetch } from '../../hooks/useProductFetch';
import { useCartManagement } from '../../hooks/useCartManagement';
import { SIZES } from '../../constants';
import { Product } from '../../types';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'apparel' | 'gear';

export const ProductGrid: React.FC = () => {
  const { products, isLoading, isWarmingUp, error } = useProductFetch();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredProducts = useMemo(() => {
    if (filter === 'all') return products;
    if (filter === 'apparel') return products.filter(p => p.category === 'apparel' || p.category === 'longsleeve');
    if (filter === 'gear') return products.filter(p => p.category === 'gear' || p.category === 'accessories');
    return products;
  }, [products, filter]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
         <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-brand-text border-t-transparent rounded-full animate-spin"></div>
            <span className="font-bold uppercase tracking-widest text-xs">
              {isWarmingUp ? 'SYSTEM_WARMING_UP...' : 'SCANNING INVENTORY...'}
            </span>
            {isWarmingUp && (
              <span className="text-[10px] opacity-40 uppercase max-w-[200px] text-center">
                Initial activation taking longer than expected. Please stand by.
              </span>
            )}
         </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {error && (
        <div className="bg-brand-text text-brand-bg text-[10px] font-black py-1 px-4 text-center uppercase tracking-widest animate-pulse">
          {error}
        </div>
      )}
      <div className="sticky top-[60px] z-30 bg-brand-bg/90 backdrop-blur border-b-2 border-brand-text px-4 py-3 flex flex-wrap gap-4 justify-between items-center transition-colors">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(['all', 'apparel', 'gear'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest border-2 transition-all whitespace-nowrap ${
                filter === f 
                ? 'bg-brand-text text-brand-bg border-brand-text' 
                : 'bg-transparent text-brand-text border-transparent hover:border-brand-text'
              }`}
            >
              {f === 'all' ? 'ВСЕ' : f === 'apparel' ? 'ОДЕЖДА' : 'СНАРЯЖЕНИЕ'}
            </button>
          ))}
        </div>

        <div className="flex border-2 border-brand-text bg-brand-bg transition-colors">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-brand-text text-brand-bg' : 'text-brand-text hover:bg-brand-text/10'}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <div className="w-[2px] bg-brand-text"></div>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-brand-text text-brand-bg' : 'text-brand-text hover:bg-brand-text/10'}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          </button>
        </div>
      </div>

      <div className={`
        ${viewMode === 'grid' 
          ? 'grid grid-cols-2 md:grid-cols-3 border-l-2 border-t-2 border-brand-text' 
          : 'flex flex-col max-w-5xl mx-auto border-x-2 border-brand-text'
        }
      `}>
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} viewMode={viewMode} />
        ))}
      </div>
    </div>
  );
};

const ProductCard: React.FC<{ product: Product; viewMode: ViewMode }> = ({ product, viewMode }) => {
  const [selectedSize, setSelectedSize] = useState(SIZES[1]);
  const { addItemToCart } = useCartManagement();

  const handleAddToCart = () => {
    const sizeToAdd = (product.category === 'gear' || product.category === 'accessories') ? 'ONE SIZE' : selectedSize;
    addItemToCart(product, sizeToAdd);
  };

  const isGear = product.category === 'gear' || product.category === 'accessories';

  if (viewMode === 'list') {
    return (
      <div className="border-b-2 border-brand-text bg-brand-bg/40 flex flex-col sm:flex-row group overflow-hidden transition-colors">
        <div className="w-full sm:w-48 h-64 sm:h-auto border-b-2 sm:border-b-0 sm:border-r-2 border-brand-text bg-brand-text/5 relative overflow-hidden flex-shrink-0">
           {product.images.length > 0 ? (
             <img 
               src={product.images[0]} 
               alt={product.name}
               className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
             />
           ) : (
             <div className="w-full h-full flex items-center justify-center bg-brand-text/10 text-[10px] font-bold">NO IMG</div>
           )}
            <div className="absolute top-2 left-2 bg-brand-text text-brand-bg text-[10px] font-bold px-2 py-1">
              {product.price}₽
            </div>
        </div>
        
        <div className="p-6 flex flex-col flex-grow justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-black uppercase text-xl md:text-2xl leading-none">{product.name}</h3>
              <span className="text-[10px] font-bold mono opacity-40 hidden sm:block">ART. {product.id}</span>
            </div>
            <p className="text-xs font-bold uppercase opacity-60 max-w-xl mb-6 leading-relaxed">
              {product.description}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between mt-4">
             {!isGear && (
                <div className="flex gap-2">
                  {SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-10 h-10 text-[10px] font-bold border-2 transition-all ${
                        selectedSize === size 
                        ? 'bg-brand-text text-brand-bg border-brand-text' 
                        : 'border-brand-text hover:bg-brand-text/10 bg-brand-bg/40'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
             )}
             
             <button 
                onClick={handleAddToCart}
                className="bg-brand-text text-brand-bg px-8 py-3 font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all active:scale-[0.98]"
             >
                В КОРЗИНУ
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-r-2 border-b-2 border-brand-text p-3 md:p-8 flex flex-col product-card-glass group transition-all hover:bg-brand-bg/70 relative">
      <div className="mb-2 md:mb-4 flex justify-between items-center text-[8px] md:text-[10px] font-bold uppercase mono opacity-50">
        <span>{product.category === 'apparel' || product.category === 'longsleeve' ? 'CLOTHING' : 'GEAR'}</span>
        <span className="hidden md:inline">{isGear ? 'LEATHER' : '230 GSM'}</span>
      </div>

      <div className="aspect-[4/5] bg-brand-text/5 mb-4 md:mb-6 overflow-hidden border-2 border-brand-text brutalist-shadow-sm group-hover:shadow-none transition-all relative">
        {product.images.length > 0 ? (
            <img 
            src={product.images[0]} 
            alt={product.name}
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500 scale-[1.01]"
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand-text/10 font-bold uppercase text-xs">NO IMG</div>
        )}
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start mb-2 md:mb-4 gap-1">
        <div>
          <h3 className="font-black uppercase text-sm md:text-2xl tracking-tighter leading-none mb-1 break-words w-full">{product.name}</h3>
          <p className="text-[9px] md:text-[10px] font-bold uppercase opacity-60 line-clamp-2 leading-tight h-auto md:h-8 hidden md:block">{product.description}</p>
        </div>
        <span className="font-black text-sm md:text-2xl tracking-tighter">{product.price}₽</span>
      </div>

      <div className="mt-auto">
        {!isGear && (
            <div className="flex gap-1 md:gap-2 mb-2 md:mb-4">
                {SIZES.map(size => (
                <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`flex-1 py-1 md:py-2 text-[9px] md:text-[10px] font-bold border-2 transition-all ${
                    selectedSize === size 
                    ? 'bg-brand-text text-brand-bg border-brand-text md:brutalist-shadow-sm' 
                    : 'border-brand-text hover:bg-brand-bg/80 bg-brand-bg/40'
                    }`}
                >
                    {size}
                </button>
                ))}
            </div>
        )}

        <button 
            onClick={handleAddToCart}
            className="w-full bg-brand-text text-brand-bg py-3 md:py-4 font-black uppercase tracking-widest text-[10px] md:text-xs flex justify-center md:justify-between px-2 md:px-6 items-center border-2 border-brand-text md:brutalist-shadow-sm hover:md:translate-x-[-2px] hover:md:translate-y-[-2px] hover:md:shadow-[4px_4px_0px_0px_var(--color-border)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
        >
            <span>В КОРЗИНУ</span>
            <svg className="hidden md:block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
        </button>
      </div>
    </div>
  );
};
