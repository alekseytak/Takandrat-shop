
import { Order, Product, CartItem } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { PRODUCTS } from '../constants';

/**
 * Универсальный метод вызова Edge Functions Supabase
 */
async function invokeFunction(functionName: string, payload: any = {}, signal?: AbortSignal, retryCount = 0): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_CONFIG_INCOMPLETE");
  }

  const projectRef = SUPABASE_URL.split('//')[1]?.split('.')[0];
  const endpoints = [
    `${SUPABASE_URL}/functions/v1/${functionName}`,
    `https://${projectRef}.functions.supabase.co/${functionName}`
  ];

  const currentEndpoint = endpoints[retryCount % endpoints.length];

  try {
    const timeoutSignal = AbortSignal.timeout(20000); 
    const combinedSignal = signal 
      ? (AbortSignal as any).any([signal, timeoutSignal])
      : timeoutSignal;

    const response = await fetch(currentEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: combinedSignal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FUNCTION_${functionName}_REJECTED_${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (err: any) {
    if (err.name === 'AbortError' && !signal?.aborted) {
      throw new Error("TRINITY_TIMEOUT: Обработка запроса заняла слишком много времени.");
    }
    
    if (retryCount < endpoints.length - 1) {
      return invokeFunction(functionName, payload, signal, retryCount + 1);
    }

    const isNetworkError = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
    if (isNetworkError) {
      const netErr = new Error("COMM_LINK_FAILURE: Облачное ядро недоступно. Проверьте соединение.");
      (netErr as any).isNetworkBlock = true;
      throw netErr;
    }

    throw err;
  }
}

export const adminService = {
  async checkTrinityStatus(): Promise<boolean> {
    try {
      const data = await invokeFunction('admin-ai', { action: 'ping' });
      return data?.status === 'online';
    } catch {
      return false;
    }
  },

  async createOrder(orderPayload: {
    telegram_id?: number;
    customer_name: string;
    phone: string;
    address: string;
    items: { product_id: string; quantity: number; price_cents: number }[];
  }): Promise<{ order_id: string }> {
    return await invokeFunction('create_order', orderPayload);
  },

  async fetchOrders(telegramId: number): Promise<Order[]> {
    try {
      return await invokeFunction('admin-ai', { action: 'fetch_orders', payload: { telegram_id: telegramId } });
    } catch (error) {
      console.warn("[ORDERS_FALLBACK]", error);
      return [];
    }
  },

  async fetchAdminStock(secret: string): Promise<any> {
    try {
      return await invokeFunction('admin-ai', { action: 'fetch_stock', payload: { secret } });
    } catch (error) {
      return { stock: [] };
    }
  },

  async searchProducts(query: string = '', isAdmin: boolean = false, signal?: AbortSignal): Promise<Product[]> {
    try {
      const data = await invokeFunction('admin-ai', { action: 'search', payload: { query, include_hidden: isAdmin } }, signal);
      if (!data?.products) throw new Error("EMPTY");
      return data.products.map((item: any) => ({
        id: item.id.toString(),
        name: item.name,
        price: item.price,
        description: item.description,
        images: item.image_url ? [item.image_url] : [],
        category: item.category,
        features: [],
        stockQuantity: item.stock_quantity,
        isVisible: item.is_visible
      }));
    } catch {
      return PRODUCTS.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    }
  },

  async chatWithAI(message: string, history: any[], telegramId?: number, signal?: AbortSignal) {
    return await invokeFunction('admin-ai', { 
      action: 'chat', 
      payload: { message, history: history.slice(-10), telegram_id: telegramId } 
    }, signal);
  }
};
