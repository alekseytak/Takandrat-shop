import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { supabase } from '@/lib/supabase';

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
        setProducts(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch products');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return { products, isLoading, isWarmingUp, error };
};
