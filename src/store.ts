
import { create } from 'zustand';
import { CartItem, Product, UserProfile, AiMetrics } from './types';
import { adminService } from './services/adminService';
import { Lang, Currency } from './lib/i18n';

const getInitialLang = (): Lang => {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('lang')?.toLowerCase();
    if (q === 'en') return 'en';
    if (q === 'ru') return 'ru';
  } catch {}
  return 'ru';
};

const getInitialCurrency = (lang: Lang): Currency => {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('currency')?.toUpperCase();
    if (q === 'USD' || q === 'EUR' || q === 'RUB') return q;
  } catch {}
  return lang === 'en' ? 'USD' : 'RUB';
};

const initialLang = getInitialLang();
const initialCurrency = getInitialCurrency(initialLang);

interface GlobalStore {
  view: 'shop' | 'corporate' | 'cart' | 'checkout' | 'chat' | 'admin' | 'info';
  setView: (view: 'shop' | 'corporate' | 'cart' | 'checkout' | 'chat' | 'admin' | 'info') => void;
  
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  lang: Lang;
  currency: Currency;
  setLang: (lang: Lang) => void;
  setCurrency: (currency: Currency) => void;
  cycleLocale: () => void;

  cart: CartItem[];
  addToCart: (product: Product, size: string) => void;
  removeFromCart: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, delta: number) => void;
  clearCart: () => void;

  currentUser: UserProfile | null;
  syncUser: (tgUser: any) => Promise<void>;

  lastAiMetrics: AiMetrics;
  setAiMetrics: (metrics: AiMetrics) => void;
}

export const useStore = create<GlobalStore>((set, get) => ({
  view: 'shop',
  setView: (view) => set({ view }),
  
  theme: 'light',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  lang: initialLang,
  currency: initialCurrency,
  setLang: (lang) => set({ lang, currency: lang === 'en' && get().currency === 'RUB' ? 'USD' : lang === 'ru' ? 'RUB' : get().currency }),
  setCurrency: (currency) => set({ currency, lang: currency === 'RUB' ? 'ru' : 'en' }),
  cycleLocale: () => set((state) => {
    if (state.lang === 'ru') return { lang: 'en', currency: 'USD' };
    if (state.currency === 'USD') return { lang: 'en', currency: 'EUR' };
    return { lang: 'ru', currency: 'RUB' };
  }),

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
      // Раньше здесь читалась таблица users с публичным ключом — и вместе с
      // нужным флагом админа можно было вычитать чужие записи. Теперь про это
      // спрашивают сервер: он проверяет подпись Telegram и отвечает только
      // «владелец или нет».
      const me = await adminService.whoAmI();
      if (me?.is_admin) set({ currentUser: { ...profile, is_admin: true } });
    } catch (err) { console.warn(err); }
  },

  lastAiMetrics: { total: 0.982, c: 0.65, d: 0.35, b: 0.88 },
  setAiMetrics: (metrics) => set({ lastAiMetrics: metrics })
}));
