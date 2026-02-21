
import { useCallback } from 'react';
import { useStore } from '../store';
import type { Product, CartItem } from '../types';

interface CartManagementResult {
  cartItems: CartItem[];
  totalPrice: number;
  totalItems: number;
  addItemToCart: (product: Product, size: string) => void;
  removeItemFromCart: (productId: string, size: string) => void;
  updateItemQuantity: (productId: string, size: string, delta: number) => void;
  clearCart: () => void;
  isItemInCart: (productId: string, size: string) => boolean;
}

export const useCartManagement = (): CartManagementResult => {
  // We use the global store as the state container, but this hook provides the interface
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useStore();

  const addItemToCart = useCallback(
    (product: Product, size: string) => {
      addToCart(product, size);
    },
    [addToCart]
  );

  const removeItemFromCartHandler = useCallback(
    (productId: string, size: string) => {
      removeFromCart(productId, size);
    },
    [removeFromCart]
  );

  const updateItemQuantityHandler = useCallback(
    (productId: string, size: string, delta: number) => {
      updateQuantity(productId, size, delta);
    },
    [updateQuantity]
  );

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const isItemInCart = useCallback(
    (productId: string, size: string) => {
        return cart.some(item => item.id === productId && item.selectedSize === size);
    },
    [cart]
  );

  return {
    cartItems: cart,
    totalPrice,
    totalItems,
    addItemToCart,
    removeItemFromCart: removeItemFromCartHandler,
    updateItemQuantity: updateItemQuantityHandler,
    clearCart,
    isItemInCart,
  };
};
