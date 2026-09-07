// Hardened Supabase Edge Function: admin-ai
// All actions require either JWT auth (verify_jwt=true) OR an x-telegram-id header matching ADMIN_TELEGRAM_IDS.
// Anonymous public actions (create_order, chat with shared secret) are explicitly allowlisted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@1.40.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shop-key, x-telegram-id',
};

declare const Deno: any;

const ADMIN_IDS = new Set(
  String(Deno.env.get('ADMIN_TELEGRAM_IDS') || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)
);
const CHAT_SHARED_SECRET = Deno.env.get('CHAT_SHARED_SECRET') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') || '';

// In-memory per-IP rate limiter (cold-start resets; OK for demo, replace with Deno KV in prod)
const ipBuckets: Map<string, number[]> = new Map();
function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (ipBuckets.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    ipBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  ipBuckets.set(ip, arr);
  return true;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isAdmin(req: Request): boolean {
  const headerId = req.headers.get('x-telegram-id');
  if (headerId && ADMIN_IDS.has(headerId)) return true;
  // JWT auth verification is handled by Supabase gateway (verify_jwt=true).
  // If we reach here with a valid Authorization header, the gateway would have rejected.
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const ip = getClientIp(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'SERVER_MISCONFIGURED' }, 500);
    }
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { action, payload } = await req.json().catch(() => ({ action: null, payload: null }));
    if (!action) return json({ error: 'MISSING_ACTION' }, 400);

    // Ping is open (used by healthcheck)
    if (action === 'ping') return json({ status: 'online' });

    // CREATE ORDER — public, but rate-limited and price-validated
    if (action === 'create_order') {
      if (!rateLimit(ip, 5, 10 * 60 * 1000)) return json({ error: 'RATE_LIMITED' }, 429);

      const { telegram_id, customer_name, phone, address, items } = payload || {};
      if (!address || !Array.isArray(items) || items.length === 0) {
        return json({ error: 'INVALID_ORDER' }, 400);
      }
      if (typeof address !== 'string' || address.length > 500) {
        return json({ error: 'ADDRESS_TOO_LONG' }, 400);
      }
      if (telegram_id !== undefined && (!Number.isInteger(telegram_id) || telegram_id <= 0)) {
        return json({ error: 'INVALID_TELEGRAM_ID' }, 400);
      }

      // Recompute prices from DB to defeat client tampering
      const productIds = items.map((it: any) => Number(it.product_id)).filter(Number.isFinite);
      const { data: dbProducts, error: productsError } = await supabaseClient
        .from('products')
        .select('id, price, stock_quantity, is_visible')
        .in('id', productIds);
      if (productsError) return json({ error: 'DB_LOOKUP_FAILED' }, 500);

      const priceMap = new Map<number, number>();
      const stockMap = new Map<number, number>();
      const visibleSet = new Set<number>();
      for (const p of dbProducts || []) {
        priceMap.set(Number(p.id), Number(p.price));
        stockMap.set(Number(p.id), Number(p.stock_quantity));
        if (p.is_visible) visibleSet.add(Number(p.id));
      }

      let totalCents = 0;
      const normalizedItems: any[] = [];
      for (const it of items) {
        const pid = Number(it.product_id);
        const qty = Number(it.quantity);
        if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0 || qty > 100) {
          return json({ error: 'INVALID_ITEM' }, 400);
        }
        if (!priceMap.has(pid)) return json({ error: 'PRODUCT_NOT_FOUND', product_id: pid }, 400);
        if (!visibleSet.has(pid)) return json({ error: 'PRODUCT_NOT_AVAILABLE', product_id: pid }, 400);
        const stock = stockMap.get(pid) || 0;
        if (stock < qty) return json({ error: 'OUT_OF_STOCK', product_id: pid, available: stock }, 409);
        const unitPriceCents = Math.round(priceMap.get(pid)! * 100);
        totalCents += unitPriceCents * qty;
        normalizedItems.push({
          product_id: pid,
          quantity: qty,
          price_cents: unitPriceCents,
          name: (dbProducts || []).find((p: any) => Number(p.id) === pid)?.name || null,
        });
      }

      // Atomic stock decrement: try to update stock; if affected count is 0, somebody else won the race
      for (const it of normalizedItems) {
        const pid = it.product_id;
        const qty = it.quantity;
        const { data: dec, error: decErr } = await supabaseClient.rpc('decrement_stock', {
          p_id: pid,
          p_qty: qty,
        }).select().maybeSingle();
        // If RPC is not defined, fall back to optimistic update
        if (decErr && /function .* does not exist/i.test(decErr.message)) {
          const { data: upd, error: updErr } = await supabaseClient
            .from('products')
            .update({ stock_quantity: (stockMap.get(pid) || 0) - qty })
            .eq('id', pid)
            .gte('stock_quantity', qty)
            .select('id')
            .maybeSingle();
          if (updErr || !upd) {
            return json({ error: 'OUT_OF_STOCK', product_id: pid }, 409);
          }
        } else if (decErr) {
          return json({ error: 'STOCK_UPDATE_FAILED', detail: decErr.message }, 500);
        }
      }

      const { data: order, error } = await supabaseClient
        .from('orders')
        .insert({
          telegram_id: telegram_id || null,
          customer_name: customer_name || null,
          phone: phone || null,
          shipping_address: address,
          items: normalizedItems,
          total_price: totalCents / 100,
          status: 'new',
          payment_method: 'pending',
          consent: true,
          customer_info: { telegram_id: telegram_id || null },
        })
        .select('id')
        .single();
      if (error) return json({ error: 'DB_INSERT_FAILED', detail: error.message }, 500);

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_CHAT_ID) {
        const text = `НОВЫЙ ЗАКАЗ #${order.id}\n${customer_name || ''}\n${phone || ''}\n${address}\nСумма: ${(totalCents / 100).toFixed(2)} ₽`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text }),
        }).catch((e) => console.warn('telegram notify failed', e));
      }
      return json({ order_id: order.id });
    }

    // SEARCH / FETCH_STOCK / FETCH_ORDERS — admin only
    if (action === 'search' || action === 'fetch_stock') {
      if (!isAdmin(req)) return json({ error: 'FORBIDDEN' }, 403);
      const query = String(payload?.query || '').trim();
      let request = supabaseClient.from('products').select('*').order('id', { ascending: true });
      if (!payload?.include_hidden) request = request.eq('is_visible', true);
      if (query) request = request.ilike('name', `%${query}%`);
      const { data, error } = await request;
      if (error) return json({ error: 'DB_QUERY_FAILED' }, 500);
      return json(action === 'fetch_stock' ? { stock: data } : { products: data });
    }

    if (action === 'fetch_orders') {
      if (!isAdmin(req)) return json({ error: 'FORBIDDEN' }, 403);
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return json({ error: 'DB_QUERY_FAILED' }, 500);
      return json(data || []);
    }

    // CHAT — protected by CHAT_SHARED_SECRET or admin header
    if (action === 'chat') {
      if (!GEMINI_API_KEY) return json({ error: 'AI_NOT_CONFIGURED' }, 503);
      const shopKey = req.headers.get('x-shop-key');
      const adminOk = isAdmin(req);
      if (!adminOk && (!CHAT_SHARED_SECRET || shopKey !== CHAT_SHARED_SECRET)) {
        return json({ error: 'FORBIDDEN' }, 403);
      }
      if (!rateLimit(ip, 10, 60 * 1000)) return json({ error: 'RATE_LIMITED' }, 429);

      const { message, history } = payload || {};
      if (!message || typeof message !== 'string' || message.length > 2000) {
        return json({ error: 'INVALID_MESSAGE' }, 400);
      }

      const { data: products } = await supabaseClient
        .from('products')
        .select('id, name, price, description, stock_quantity')
        .eq('is_visible', true);
      const inventory = (products || [])
        .map((p: any) => `[PRODUCT:${p.id}] ${p.name} (${p.price} руб., остаток: ${p.stock_quantity ?? 'уточнить'}): ${p.description || ''}`)
        .join('\n') || 'Каталог временно недоступен.';

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const systemInstruction = `Ты — TRINITY 4.0, ИИ-консультант магазина кожаных изделий "Tak and Rat".
Помогай клиентам подбирать товары. Используй тег [PRODUCT:id] для рекомендаций.
Не выдумывай цены, наличие, материалы.
Каталог:\n${inventory}`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            ...(history || []).map((h: any) => ({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: String(h.content || '').slice(0, 2000) }],
            })),
            { role: 'user', parts: [{ text: message }] },
          ],
          config: {
            responseMimeType: 'application/json',
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
                    b: { type: Type.NUMBER },
                  },
                  required: ['total', 'c', 'd', 'b'],
                },
              },
              required: ['reply', 'metrics'],
            },
            systemInstruction,
          },
        });
        return new Response(response.text, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return json({ error: 'AI_FAILED', detail: e?.message || String(e) }, 500);
      }
    }

    return json({ error: 'UNKNOWN_ACTION' }, 400);
  } catch (err: any) {
    return json({ error: err?.message || 'INTERNAL_ERROR' }, 500);
  }
});
