
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_MODEL = 'arcee-ai/trinity-large-preview:free';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || "";
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    const { action, payload } = await req.json();

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    if (action === 'chat') {
      if (!openRouterKey) throw new Error('OPENROUTER_API_KEY not configured');

      const { message, history } = payload;
      
      // Fetch products catalog
      const { data: products } = await supabaseClient
        .from('products')
        .select('id, name, price, description, image_url')
        .eq('is_visible', true);
        
      const inventory = products?.map(p => 
        `[PRODUCT:${p.id}] ${p.name} (${p.price} руб.): ${p.description}`
      ).join('\n') || "Inventory offline.";

      // Compose messages for OpenRouter (OpenAI-compatible)
      const systemMessage = `
      Ты — TRINITY 4.0, ИИ-интерфейс "Ателье Кожи" (Tak and Rat).
      Стиль: лаконичный, брутальный, функциональный.
      Обращайся кратко на русском.
      Помогай выбрать изделия из кожи: браслеты, кошельки, ремни.
      Используй тег [PRODUCT:ID] для рекомендации.
      Каталог:
      ${inventory}
      `;

      const messages = [
        { role: 'system', content: systemMessage },
        ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window?.location?.href || supabaseUrl,
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages,
          max_tokens: 512,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'NO_REPLY';

      // Dummy metrics (Trinity could compute these if needed)
      const metrics = { total: 0.95, c: 0.6, d: 0.4, b: 0.9 };

      return new Response(JSON.stringify({ reply, metrics }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (action === 'ping') {
      return new Response(JSON.stringify({ status: 'online' }), { headers: corsHeaders });
    }

    // Existing DB actions (fetch_orders, fetch_stock, search) remain unchanged...
    if (action === 'fetch_orders') {
      const { telegram_id } = payload;
      const { data } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('telegram_id', telegram_id)
        .order('created_at', { ascending: false })
        .limit(10);
      return new Response(JSON.stringify(data || []), { headers: corsHeaders });
    }

    if (action === 'fetch_stock') {
      const { secret } = payload;
      if (secret !== Deno.env.get('ADMIN_SECRET')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
      }
      const { data } = await supabaseClient
        .from('products')
        .select('id, name, stock_quantity');
      return new Response(JSON.stringify({ stock: data || [] }), { headers: corsHeaders });
    }

    if (action === 'search') {
      const { query, include_hidden } = payload;
      let q = supabaseClient.from('products').select('*');
      if (query) q = q.ilike('name', `%${query}%`);
      if (!include_hidden) q = q.eq('is_visible', true);
      const { data } = await q.limit(50);
      return new Response(JSON.stringify({ products: data || [] }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'UNKNOWN_ACTION' }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
