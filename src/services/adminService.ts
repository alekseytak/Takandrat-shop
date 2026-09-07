import { Order, Product, CartItem } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { PRODUCTS } from '../constants';

/**
 * Universal method for calling Supabase Edge Functions
 */
async function invokeFunction(functionName: string, payload: any = {}, signal?: AbortSignal): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_CONFIG_INCOMPLETE");
  }

  const projectRef = SUPABASE_URL.split('//')[1]?.split('.')[0];
  const endpoint = `${SUPABASE_URL}/functions/v1/${functionName}`;

  try {
    const timeoutSignal = AbortSignal.timeout(20000);
    const combinedSignal = signal
      ? (AbortSignal as any).any([signal, timeoutSignal])
      : timeoutSignal;

    const response = await fetch(endpoint, {
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
      throw new Error("TRINITY_TIMEOUT: Request processing took too long.");
    }

    const isNetworkError = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
    if (isNetworkError) {
      const netErr = new Error("COMM_LINK_FAILURE: Cloud core is unavailable. Check connection.");
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
    return await invokeFunction('admin-ai', { action: 'create_order', payload: orderPayload });
  },

  async fetchOrders(telegramId: number): Promise<Order[]> {
    try {
      return await invokeFunction('admin-ai', { action: 'fetch_orders', payload: { telegram_id: telegramId } });
    } catch (error) {
      console.warn("[ORDERS_FALLBACK]", error);
      return [];
    }
  },

  async fetchAdminStock(telegramId: number): Promise<any> {
    try {
      return await invokeFunction('admin-ai', { action: 'fetch_stock', payload: { telegramId } });
    } catch (error) {
      return { stock: [] };
    }
  },

  async searchProducts(query: string = '', isAdmin: boolean = false, signal?: AbortSignal, telegramId?: number): Promise<Product[]> {
    try {
      const data = await invokeFunction('admin-ai', { action: 'search', payload: { query, include_hidden: isAdmin, telegramId } }, signal);
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

  async createProduct(productData: any, telegramId: number) {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': telegramId.toString()
        },
        body: JSON.stringify(productData)
      });
      if (!response.ok) throw new Error('Failed to create product');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async chatWithAI(message: string, history: any[], telegramId?: number, attachments?: any[], signal?: AbortSignal) {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (telegramId) {
        headers['x-shop-key'] = telegramId.toString();
      }
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, history, attachments }),
        signal
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || 'Chat failed');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error("Chat Error:", error);
      throw error;
    }
  },

  async chatWithAdminAI(message: string, history: any[], telegramId?: number, attachments?: any[], signal?: AbortSignal) {
    try {
      const response = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, telegramId, attachments }),
        signal
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || 'Admin Chat failed');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error("Admin Chat Error:", error);
      throw error;
    }
  },

  async fetchGoogleDriveFile(url: string, accessToken?: string) {
    try {
      const response = await fetch('/api/admin/drive-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, accessToken })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || 'Drive File fetch failed');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error("Drive Fetch Error:", error);
      throw error;
    }
  }
};
