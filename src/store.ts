
import { create } from 'zustand';
import { CartItem, Product, UserProfile, AiMetrics } from './types';
import { supabase } from './lib/supabase';

interface GlobalStore {
  view: 'shop' | 'corporate' | 'cart' | 'checkout' | 'chat' | 'admin' | 'info';
  setView: (view: 'shop' | 'corporate' | 'cart' | 'checkout' | 'chat' | 'admin' | 'info') => void;
  
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  cart: CartItem[];
  addToCart: (product: Product, size: string) => void;
  removeFromCart: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, delta: number) => void;
  clearCart: () => void;

  currentUser: UserProfile | null;
  syncUser: (tgUser: any) => Promise<void>;
  forceAdmin: () => void;

  lastAiMetrics: AiMetrics;
  setAiMetrics: (metrics: AiMetrics) => void;
}

export const useStore = create<GlobalStore>((set, get) => ({
  view: 'shop',
  setView: (view) => set({ view }),
  
  theme: 'light',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  cart: [],
  addToCart: (product, size) => set((state) => {
    const existingIndex = state.cart.findIndex(item => item.id === product.id && item.selectedSize === size);
    if (existingIndex > -1) {
      const newCart = [...state.cart];
      newCart[existingIndex].quantity += 1;
      return { cart: newCart };
    }
    return { cart: [...state.cart, { ...product, selectedSize: size, quantity: 1 }] };
  }),
  removeFromCart: (productId, size) => set((state) => ({
    cart: state.cart.filter(item => !(item.id === productId && item.selectedSize === size))
  })),
  updateQuantity: (productId, size, delta) => set((state) => ({
    cart: state.cart.map(item => 
      (item.id === productId && item.selectedSize === size) 
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item
    )
  })),
  clearCart: () => set({ cart: [] }),

  currentUser: null,
  syncUser: async (tgUser) => {
    if (!tgUser) return;
    const profile: UserProfile = {
      telegram_id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name
    };
    set({ currentUser: profile });
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgUser.id)
        .single();
      if (existingUser) {
        set({ currentUser: { ...profile, ...existingUser } });
      }
    } catch (err) { console.warn(err); }
  },

  forceAdmin: () => set((state) => ({
    currentUser: state.currentUser 
      ? { ...state.currentUser, is_admin: true } 
      : { telegram_id: 0, is_admin: true }
  })),

  lastAiMetrics: { total: 0.982, c: 0.65, d: 0.35, b: 0.88 },
  setAiMetrics: (metrics) => set({ lastAiMetrics: metrics })
}));
