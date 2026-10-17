import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { supabase } from '@/lib/supabase';
import { PRODUCTS } from '@/constants';

/** Сколько ждём базу, прежде чем показать встроенный каталог. */
const CATALOG_TIMEOUT_MS = 4000;

/**
 * Откуда витрина берёт каталог.
 *
 * `code` — из `src/constants.ts`, и тогда в базу за каталогом витрина не ходит
 * вовсе. `database` — из таблицы `products`, прежнее поведение.
 *
 * По умолчанию каталог берётся из кода, и это решение владельца, а не
 * забывчивость. Причина: база магазина на бесплатном тарифе уходит в паузу от
 * простоя — 16 октября проект `takandrat` стоял `INACTIVE`, адрес не
 * разрешался вовсе, и каждая загрузка витрины тянула четыре секунды ожидания и
 * восемь запросов в никуда, прежде чем показать товары из кода. Фотографии и
 * тексты лежат в репозитории и уезжают на Vercel сборкой, поэтому для каталога
 * база витрине не нужна: она нужна заказам и админке, а те ходят в неё своим
 * путём.
 *
 * Вернуть прежнее поведение можно переменной окружения, не правя код:
 * `VITE_CATALOG_SOURCE=database`.
 */
const CATALOG_FROM_CODE = (() => {
  try {
    const value = (import.meta as any)?.env?.VITE_CATALOG_SOURCE;
    return String(value ?? 'code').trim().toLowerCase() !== 'database';
  } catch {
    return true;
  }
})();

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
  // Набор снимков товара, если он есть в базе; иначе одна фотография.
  images: Array.isArray(row.images) && row.images.length > 0
    ? (row.images as unknown[]).map((item) => String(item))
    : row.image_url
      ? [String(row.image_url)]
      : [],
  sizes: Array.isArray(row.sizes)
    ? (row.sizes as unknown[]).map((item) => String(item)).filter((item) => item.length > 0)
    : [],
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
      // Каталог из кода — в базу не ходим вовсе: ни ожидания, ни запросов.
      // Это не оптимизация, а условие работы: пока база на паузе, любой заход
      // в неё — четыре секунды пустого ожидания; а когда база оживает, её
      // каталог подменяет собой тот, что лежит в репозитории, и на витрине
      // оказываются старые товары.
      if (CATALOG_FROM_CODE) {
        setProducts(PRODUCTS);
        setIsLoading(false);
        return;
      }
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
