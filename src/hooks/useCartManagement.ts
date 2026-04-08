import { useStore } from '@/store';
import { Product } from '@/types';

export const useCartManagement = () => {
  const { addToCart } = useStore();

  const addItemToCart = (product: Product, size: string) => {
    addToCart(product, size);
  };

  return { addItemToCart };
};
