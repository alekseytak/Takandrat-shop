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

/**
 * Строка базы в форму товара витрины.
 *
 * В базе фотография одна и лежит в `image_url`, а витрина ждёт массив `images`
 * (карточка читает `product.images.length`). Пока перевода не было, живая база
 * роняла витрину целиком: карточка обращалась к отсутствующему полю, React
 * снимал дерево, и покупатель видел пустую страницу. Поэтому данные базы
 * приводятся к форме здесь — на входе, а не заплатками в отрисовке.
 */
/** Категории, которые знает витрина. */
const CATEGORIES: Product['category'][] = ['longsleeve', 'accessories', 'gear', 'apparel'];

/**
 * Категория из базы. Незнакомую не выдумываем и витрину из-за неё не роняем:
 * товар попадает в общую группу, а расхождение видно при сверке с базой.
 */
const categoryOf = (value: unknown): Product['category'] => {
  const text = String(value ?? '') as Product['category'];
  return CATEGORIES.includes(text) ? text : 'apparel';
};

const fromDatabase = (row: Record<string, unknown>): Product => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  price: Number(row.price ?? 0),
  description: String(row.description ?? ''),
  images: row.image_url ? [String(row.image_url)] : [],
  category: categoryOf(row.category),
  features: Array.isArray(row.features) ? (row.features as string[]) : [],
});

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
          setProducts(data.map((row) => fromDatabase(row as Record<string, unknown>)));
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
