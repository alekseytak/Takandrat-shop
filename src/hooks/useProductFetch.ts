import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { supabase } from '@/lib/supabase';
import { PRODUCTS } from '@/constants';

/** Сколько ждём базу, прежде чем показать встроенный каталог. */
const CATALOG_TIMEOUT_MS = 4000;

/**
 * Обещание с пределом ожидания. Без него зависший запрос к базе оставляет
 * витрину на «СКАНИРОВАНИЕ ИНВЕНТАРЯ…» навсегда: покупатель не видит товаров
 * и не может ничего заказать, хотя каталог лежит в коде.
 */
const withTimeout = <T,>(promise: PromiseLike<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`база не ответила за ${ms} мс`)), ms)),
  ]);

export const useProductFetch = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await withTimeout(
          supabase.from('products').select('*'),
          CATALOG_TIMEOUT_MS,
        );
        if (error) throw error;

        if (data && data.length > 0) {
          setProducts(data);
        } else {
          // Таблица пуста — показываем встроенный каталог.
          setProducts(PRODUCTS);
        }
      } catch (err: any) {
        // Молча: покупателю нечего делать с сообщением о базе, а товары
        // должны быть на витрине. Владелец увидит причину в консоли.
        console.warn('Каталог из базы недоступен, показываю встроенный:', err?.message ?? err);
        setProducts(PRODUCTS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return { products, isLoading, isWarmingUp, error };
};
