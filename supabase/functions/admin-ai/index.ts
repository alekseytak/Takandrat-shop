
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@1.40.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || "";
    // @ts-ignore
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
    const { action, payload } = await req.json();

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    if (action === 'create_order') {
      const { telegram_id, customer_name, phone, address, items } = payload || {};
      if (!address || !Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: 'INVALID_ORDER' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const total = items.reduce((sum: number, item: any) => sum + Number(item.price_cents || 0) * Number(item.quantity || 0), 0);
      const { data: order, error } = await supabaseClient.from('orders').insert({
        telegram_id: telegram_id || null,
        customer_info: { telegram_id: telegram_id || null },
        shipping_address: address,
        items,
        total_price: total / 100,
        status: 'new',
        payment_method: 'pending',
        consent: true
      }).select('id').single();
      if (error) throw error;

      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const adminChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
      if (botToken && adminChatId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: adminChatId, text: `НОВЫЙ ЗАКАЗ #${order.id}\n${customer_name}\n${phone}\n${address}\nСумма: ${(total / 100).toFixed(2)} ₽` })
        });
      }
      return new Response(JSON.stringify({ order_id: order.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'search' || action === 'fetch_stock') {
      const query = String(payload?.query || '').trim();
      let request = supabaseClient.from('products').select('*').order('id', { ascending: true });
      if (action === 'search' && !payload?.include_hidden) request = request.eq('is_visible', true);
      if (query) request = request.ilike('name', `%${query}%`);
      const { data, error } = await request;
      if (error) throw error;
      return new Response(JSON.stringify(action === 'fetch_stock' ? { stock: data } : { products: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'fetch_orders') {
      const { data, error } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'chat') {
      const { message, history } = payload;
      
      const { data: products } = await supabaseClient
        .from('products')
        .select('id, name, price, description')
        .eq('is_visible', true);
        
      const inventory = products?.map(p => 
        `[PRODUCT:${p.id}] ${p.name} (${p.price} руб.): ${p.description}`
      ).join('\n') || "Inventory offline.";

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const systemInstruction = `
      ПРОТОКОЛ ИНТЕРФЕЙСА: КВАНТОВО-ЭТИЧЕСКИЙ ГРАДИЕНТ ГАРМОНИИ (∇ε_Total)
      Ты — TRINITY 4.0, ИИ-интерфейс "Ателье Кожи".
      
      МЕТОДОЛОГИЯ ВЫЧИСЛЕНИЯ:
      ∇ε_Total = wC * C + wD * D + wB * ∇ε_B
      C (Консеквенциализм): Максимизация пользы изделия.
      D (Деонтология): Соблюдение принципов качества и честности.
      ∇ε_B (Градиент Буданова): Октавная когерентность и антихрупкость.

      ТВОЯ РОЛЬ:
      - Продажа кожаных аксессуаров: браслеты, кошельки, ремни.
      - Стиль: Лаконичный, брутальный, функциональный.
      - Помогай выбрать модель. Используй тег [PRODUCT:ID] для рекомендации.
      - Соблюдай конфиденциальность. Мы удаляем данные через 72 часа.

      АКТУАЛЬНЫЙ КАТАЛОГ:
      ${inventory}

      ОТВЕТ В ФОРМАТЕ JSON.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          ...(history || []).map((h: any) => ({ 
            role: h.role === 'assistant' ? 'model' : 'user', 
            parts: [{ text: h.content }] 
          })),
          { role: 'user', parts: [{ text: message }] }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              metrics: {
                type: Type.OBJECT,
                properties: {
                  total: { type: Type.NUMBER },
                  c: { type: Type.NUMBER },
                  d: { type: Type.NUMBER },
                  b: { type: Type.NUMBER }
                },
                required: ["total", "c", "d", "b"]
              }
            },
            required: ["reply", "metrics"]
          },
          systemInstruction,
          thinkingConfig: { thinkingBudget: 12000 }
        }
      });

      return new Response(response.text, { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Ping / Fetch logic...
    if (action === 'ping') return new Response(JSON.stringify({ status: 'online' }), { headers: corsHeaders });
    
    return new Response(JSON.stringify({ error: 'UNKNOWN_ACTION' }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
