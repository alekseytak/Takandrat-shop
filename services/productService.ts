
import { supabase } from './supabaseClient';
import type { Product } from '../types';

export const productService = {
  /**
   * Fetch all visible products from Supabase
   * Maps DB fields (snake_case) to Frontend Domain Model (camelCase)
   */
  async fetchAllProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_visible', true)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    if (!data) return [];

    // Mapping DB structure to Frontend Type
    return data.map((item: any) => ({
      id: item.id.toString(), // Convert BigInt/Number to string for frontend consistency
      dbId: item.id,
      name: item.name,
      price: item.price,
      description: item.description,
      images: item.image_url ? [item.image_url] : [], // Wrap single URL in array
      category: item.category,
      features: ['100% Cotton', 'Premium Quality'], // Default features or fetch from JSONB if added later
      stockQuantity: item.stock_quantity
    }));
  },

  /**
   * Fetch product by ID
   */
  async getProductById(productId: number): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) {
       // Ignore 'Row not found' error code for generic return null
       if (error.code !== 'PGRST116') {
         console.error('Error fetching product:', error);
       }
       return null;
    }

    return {
      id: data.id.toString(),
      dbId: data.id,
      name: data.name,
      price: data.price,
      description: data.description,
      images: data.image_url ? [data.image_url] : [],
      category: data.category,
      features: [],
      stockQuantity: data.stock_quantity
    };
  }
};
