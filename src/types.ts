// Frontend Types
export type Product = {
  id: string; 
  dbId?: number;
  name: string;
  price: number;
  description: string;
  images: string[];
  // Added 'apparel' to the category union to fix type comparison errors in components/Store/ProductGrid.tsx
  category: 'longsleeve' | 'accessories' | 'gear' | 'apparel';
  features: string[];
  stockQuantity?: number;
  isVisible?: boolean; 
};

export type AiMetrics = {
  total: number;
  c: number;
  d: number;
  b: number;
};

export type CartItem = Product & {
  selectedSize: string;
  quantity: number;
  db_id?: number; 
};

export type UserProfile = {
  id?: number; 
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
  address?: string;
  is_admin?: boolean;
};

export type DeliveryDetails = {
  fullName: string;
  phone: string;
  city: string;
  address: string;
  comment: string;
  paymentMethod: 'card' | 'crypto';
};

export type Order = {
  id: string;
  user_id?: number;
  telegram_id?: number;
  created_at: string;
  items: CartItem[]; 
  delivery_details: DeliveryDetails;
  shipping_address?: string;
  customer_info?: any;
  total_price: number;
  status: 'new' | 'pending' | 'paid' | 'shipped' | 'completed';
  payment_method: string;
  consent?: boolean;
};

export type AppState = {
  view: 'shop' | 'corporate' | 'cart' | 'checkout' | 'chat' | 'admin' | 'info';
  setView: (view: 'shop' | 'corporate' | 'cart' | 'checkout' | 'chat' | 'admin' | 'info') => void;
};