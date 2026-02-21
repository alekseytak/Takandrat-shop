
import { useState, useEffect, useRef } from 'react';
import { adminService } from '../services/adminService';
import { PRODUCTS } from '../constants';
import { useStore } from '../store';
import type { Product } from '../types';

/**
 * Custom hook to fetch products with support for search, loading, and "warming up" states.
 * isWarmingUp becomes true if the backend takes more than 5 seconds to respond.
 */
export const useProductFetch = (searchQuery: string = '') => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Fix: Added isWarmingUp state to track long-running activation/scans
  const [isWarmingUp, setIsWarmingUp] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useStore();
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let isMounted = true;
    let warmingTimer: ReturnType<typeof setTimeout> | undefined;

    const loadProducts = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setIsLoading(true);
        setError(null);
        setIsWarmingUp(false);

        // Start a timer to indicate "warming up" if loading exceeds threshold
        warmingTimer = setTimeout(() => {
          if (isMounted) setIsWarmingUp(true);
        }, 5000);

        const data = await adminService.searchProducts(
          searchQuery, 
          !!currentUser?.is_admin,
          controller.signal
        );
        
        if (isMounted) {
          // If the cloud response is empty or blocked, fallback to static local catalog
          setProducts(data && data.length > 0 ? data : PRODUCTS);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (isMounted) {
          setProducts(PRODUCTS);
          setError(err.message || 'SCAN_PROTOCOL_ERROR');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsWarmingUp(false);
          if (warmingTimer) clearTimeout(warmingTimer);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      }
    };

    const debounceTimer = setTimeout(loadProducts, searchQuery ? 300 : 0);
    
    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
      if (warmingTimer) clearTimeout(warmingTimer);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [searchQuery, currentUser?.is_admin]);

  // Fix: Return isWarmingUp to satisfy the destructuring in components/Store/ProductGrid.tsx
  return { products, isLoading, isWarmingUp, error };
};
