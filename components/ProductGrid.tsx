
import React, { useState } from 'react';
import { PRODUCTS, SIZES } from '../constants';
import { useStore } from '../store';
import { Product } from '../types';

export const ProductGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {PRODUCTS.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};

const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const [selectedSize, setSelectedSize] = useState(SIZES[2]); 
  const { addToCart } = useStore();

  const handleAddToCart = () => {
    addToCart(product, selectedSize);
  };

  return (
    <div className="border-r-2 border-b-2 border-black p-8 flex flex-col product-card-glass group transition-all hover:bg-white/70">
      <div className="mb-6 flex justify-between items-center text-[10px] font-bold uppercase mono opacity-50">
        <span>Art. {product.id}</span>
        <span>230 GSM</span>
      </div>

      <div className="aspect-[4/5] bg-gray-100/50 mb-8 overflow-hidden border-2 border-black brutalist-shadow-sm group-hover:shadow-none transition-all">
        <img 
          src={product.images[0]} 
          alt={product.name}
          className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500 scale-[1.01]"
        />
      </div>
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-black uppercase text-2xl tracking-tighter leading-none">{product.name}</h3>
          <p className="text-[10px] font-bold uppercase mt-2 opacity-60">Пенье компакт / 100% Cotton</p>
        </div>
        <span className="font-black text-2xl tracking-tighter">{product.price}₽</span>
      </div>
      
      <div className="flex gap-2 mb-8 flex-wrap">
        {SIZES.map(size => (
          <button
            key={size}
            onClick={() => setSelectedSize(size)}
            className={`w-12 h-12 text-xs font-bold border-2 transition-all ${
              selectedSize === size 
              ? 'bg-black text-white border-black brutalist-shadow-sm translate-x-[-2px] translate-y-[-2px]' 
              : 'border-black hover:bg-white/80 bg-white/40'
            }`}
          >
            {size}
          </button>
        ))}
      </div>
      
      <button 
        onClick={handleAddToCart}
        className="w-full bg-black text-white py-5 font-bold uppercase tracking-widest text-sm flex justify-between px-8 items-center border-2 border-black brutalist-shadow-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
      >
        <span>В корзину</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12h14m-7-7l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};
