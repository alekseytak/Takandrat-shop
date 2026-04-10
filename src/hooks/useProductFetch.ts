import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { supabase } from '@/lib/supabase';
import { PRODUCTS } from '@/constants';

export const useProductFetch = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;
        
        if (data && data.length > 0) {
          setProducts(data);
        } else {
          // Fallback to local products if table is empty
          setProducts(PRODUCTS);
        }
      } catch (err: any) {
        console.error('Supabase fetch failed, falling back to local products:', err);
        setProducts(PRODUCTS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return { products, isLoading, isWarmingUp, error };
};
