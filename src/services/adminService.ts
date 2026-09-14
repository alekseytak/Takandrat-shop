
import { Order, Product, CartItem } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { orderErrorMessage } from '../lib/orderError';
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

/** Подпись мини-приложения: по ней сервер видит, кто именно просит. */
const telegramInitData = (): string => {
  const value = (window as any)?.Telegram?.WebApp?.initData;
  return typeof value === 'string' ? value : '';
};

export const adminService = {
  async checkTrinityStatus(): Promise<boolean> {
    try {
      const data = await invokeFunction('admin-ai', { action: 'ping' });
      return data?.status === 'online';
    } catch {
      return false;
    }
  },

  /**
   * Отправляет заказ на сервер. Цена и наличие здесь не передаются: их
   * считает Edge Function по каталогу, чтобы заказ нельзя было удешевить
   * правкой запроса. Размер передаётся — по нему мастер шьёт изделие.
   */
  async createOrder(orderPayload: {
    customer_name: string;
    phone: string;
    address: string;
    /** Один ключ на попытку оформления: повтор не создаёт второй заказ. */
    idempotency_key?: string;
    items: { product_id: string; quantity: number; size: string }[];
  }): Promise<{ order_id: string; total?: number; repeated?: boolean }> {
    try {
      // Подпись Telegram едет вместе с заказом: сервер иначе не знает, кто
      // заказывает, и верит полю telegram_id на слово. См. telegram.ts.
      return await invokeFunction('admin-ai', {
        action: 'create_order',
        payload: { ...orderPayload, init_data: telegramInitData() },
      });
    } catch (error: any) {
      throw new Error(orderErrorMessage(error));
    }
  },

  /**
   * Кто я: владелец или покупатель. Решает сервер по подписи Telegram и списку
   * id владельцев — клиент к таблице users за этим больше не ходит.
   */
  async whoAmI(): Promise<{ is_admin: boolean; reason?: string }> {
    try {
      return await invokeFunction('admin-ai', { action: 'whoami', payload: { init_data: telegramInitData() } });
    } catch (error) {
      console.warn("[WHOAMI_FALLBACK]", error);
      return { is_admin: false };
    }
  },

  // Заказы всех покупателей и склад — только владельцу. Кто владелец, решает
  // сервер по подписи и списку id: здесь об этом не спрашивают.
  async fetchOrders(): Promise<Order[]> {
    try {
      return await invokeFunction('admin-ai', { action: 'fetch_orders', payload: { init_data: telegramInitData() } });
    } catch (error) {
      console.warn("[ORDERS_FALLBACK]", error);
      return [];
    }
  },

  async fetchAdminStock(): Promise<any> {
    try {
      return await invokeFunction('admin-ai', { action: 'fetch_stock', payload: { init_data: telegramInitData() } });
    } catch (error) {
      console.warn("[STOCK_FALLBACK]", error);
      return { stock: [] };
    }
  },

  async searchProducts(query: string = '', isAdmin: boolean = false, signal?: AbortSignal): Promise<Product[]> {
    try {
      const data = await invokeFunction('admin-ai', {
        action: 'search',
        payload: { query, include_hidden: isAdmin, init_data: telegramInitData() },
      }, signal);
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
