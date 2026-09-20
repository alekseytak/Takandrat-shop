
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { buildOrder } from "./order.ts";
import { verifyInitData } from "./telegram.ts";
import { decideByKey, idempotencyKey } from "./idempotency.ts";
import { adminIdsFromEnv, authorizeAdmin, isPrivilegedAction } from "./admin.ts";

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

    // Привилегированные действия: все заказы покупателей, склад, скрытые
    // товары. Раньше они не проверяли никого — заказы с именами, адресами и
    // составом отдавались любому, кто знает адрес функции. Личность берётся из
    // подписи Telegram, право — из списка владельцев.
    if (isPrivilegedAction(action, payload)) {
      const adminToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
      if (adminToken.length === 0) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN', reason: 'ADMIN_UNVERIFIABLE' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const adminSignature = await verifyInitData(payload?.init_data, adminToken);
      if (!adminSignature.ok) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN', reason: adminSignature.reason }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const owners = adminIdsFromEnv(Deno.env.get('ADMIN_TELEGRAM_IDS'), Deno.env.get('TELEGRAM_ADMIN_CHAT_ID'));
      const allowed = authorizeAdmin(adminSignature.user.id, owners);
      if (!allowed.ok) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN', reason: allowed.reason }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (action === 'create_order') {
      const { telegram_id, customer_name, phone, address, items, init_data, idempotency_key } = payload || {};
      if (typeof address !== 'string' || address.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'INVALID_ORDER', reason: 'EMPTY_ADDRESS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Кто заказывает — тоже не берём на слово. Раньше telegram_id приходил
      // из тела запроса, и заказ можно было создать от чужого имени. Теперь
      // личность берётся из подписи Telegram, а без подписи заказа нет.
      const botTokenForSignature = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
      if (botTokenForSignature.length === 0) {
        // Открытый приём заказов хуже отказа: без токена подпись проверить
        // нечем, значит проверить личность покупателя невозможно.
        return new Response(JSON.stringify({ error: 'INVALID_ORDER', reason: 'INIT_DATA_UNVERIFIABLE' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const signature = await verifyInitData(init_data, botTokenForSignature);
      if (!signature.ok) {
        return new Response(JSON.stringify({ error: 'INVALID_ORDER', reason: signature.reason }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const buyerId = signature.user.id;
      const buyerName = signature.user.first_name || customer_name || 'Покупатель Telegram';

      // Цене, количеству и наличию из браузера не верим: их диктует каталог.
      // Раньше сумма считалась по price_cents из запроса, то есть любой мог
      // заказать ремень за копейку. Проверки живут в order.ts и покрыты тестом.
      const requestedIds = (Array.isArray(items) ? items : [])
        .map((item: any) => String(item?.product_id ?? '').trim())
        .filter((id: string) => id.length > 0);
      let catalog: any[] = [];
      if (requestedIds.length > 0) {
        const { data, error: catalogError } = await supabaseClient
          .from('products')
          .select('*')
          .in('id', requestedIds);
        if (catalogError) throw catalogError;
        catalog = data ?? [];
      }

      const built = buildOrder(items, catalog);
      if (!built.ok) {
        return new Response(JSON.stringify({ error: 'INVALID_ORDER', reason: built.reason, detail: built.detail ?? null }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Тот же ключ — тот же заказ. Если ответ потерялся в сети и покупатель
      // нажал ещё раз, второй заказ не создаётся: возвращаем прежний.
      // Запрос к базе может не поддержать разбор jsonb — тогда честно
      // помечаем, что проверка не выполнялась, но заказ не теряем.
      const repeatKey = idempotencyKey(idempotency_key);
      let existing: { id: string; total_price?: number | null }[] | null = null;
      let keyChecked = false;
      if (repeatKey !== null) {
        const { data, error: lookupError } = await supabaseClient
          .from('orders')
          .select('id, total_price')
          .eq('customer_info->>idempotency_key', repeatKey)
          .limit(5);
        if (lookupError) {
          console.warn('[ORDER_IDEMPOTENCY] проверка ключа не удалась:', lookupError.message);
        } else {
          existing = data ?? [];
          keyChecked = true;
        }
      }
      const repeat = decideByKey(existing, repeatKey);
      if (repeat.kind === 'repeat') {
        return new Response(JSON.stringify({ order_id: repeat.orderId, total: repeat.total, repeated: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: order, error } = await supabaseClient.from('orders').insert({
        telegram_id: buyerId,
        customer_info: {
          telegram_id: buyerId,
          verified_by: 'telegram_init_data',
          ...(repeatKey === null ? {} : { idempotency_key: repeatKey, idempotency_checked: keyChecked }),
        },
        shipping_address: address.trim(),
        items: built.lines,
        total_price: built.totalCents / 100,
        status: 'new',
        payment_method: 'pending',
        consent: true
      }).select('id').single();
      if (error) throw error;

      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const adminChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
      if (botToken && adminChatId) {
        const composition = built.lines
          .map((line) => `${line.name || line.product_id}${line.size ? ` / ${line.size}` : ''} × ${line.quantity}`)
          .join('\n');
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: adminChatId, text: `НОВЫЙ ЗАКАЗ #${order.id}\n${buyerName}\n${phone}\n${address}\n${composition}\nСумма: ${(built.totalCents / 100).toFixed(2)} ₽` })
        });
      }
      return new Response(JSON.stringify({ order_id: order.id, total: built.totalCents / 100 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'search' || action === 'fetch_stock') {
      const query = String(payload?.query || '').trim();
      let request = supabaseClient.from('products').select('*').order('id', { ascending: true });
      // Строго === true: иначе «true» строкой обходил бы фильтр скрытых товаров.
      if (action === 'search' && payload?.include_hidden !== true) request = request.eq('is_visible', true);
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

      // Deno не знает process.env: в функции окружение читается через Deno.env.
      // С process.env эта ветка падала на ReferenceError, и чат не отвечал.
      // Провайдеры OpenAI-совместимые: OpenRouter первым, LiteRouter запасным.
      // Gemini выпилен. LiteRouter ограничен по входному контексту — для чата
      // хватает, для длинных историй предпочтителен OpenRouter.
      const aiKey = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('API_KEY') || '';
      const litKey = Deno.env.get('LITEROUTER_API_KEY') || '';
      if (aiKey.length === 0 && litKey.length === 0) {
        return new Response(JSON.stringify({ error: 'CHAT_UNAVAILABLE', reason: 'API_KEY_MISSING' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const providers = [];
      if (aiKey) providers.push({ key: aiKey, base: 'https://openrouter.ai/api/v1/chat/completions', model: Deno.env.get('AI_MODEL') || 'meta-llama/llama-3.1-8b-instruct:free' });
      if (litKey) providers.push({ key: litKey, base: 'https://api.literouter.com/v1/chat/completions', model: 'deepseek-v3.1:free' });
      
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

      const messages = [
        { role: 'system', content: systemInstruction },
        ...(history || []).map((h: any) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: message },
      ];

      let text = '';
      for (const p of providers) {
        try {
          const upstream = await fetch(p.base, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${p.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: p.model,
              messages,
              response_format: { type: 'json_object' },
            }),
          });
          if (!upstream.ok) continue;
          const data = await upstream.json();
          text = data.choices?.[0]?.message?.content || '';
          if (text) break;
        } catch {
          // неисправный провайдер — пробуем следующий
        }
      }
      if (!text) {
        return new Response(JSON.stringify({ error: 'CHAT_UNAVAILABLE', reason: 'UPSTREAM_FAILED' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(text, { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Ping / Fetch logic...
    // Кто я. Клиент больше не читает таблицу users, чтобы узнать, админ ли он:
    // с публичным ключом это позволяло вычитать чужие записи. Ответ даёт
    // сервер, и только «владелец или нет», без чужих данных.
    if (action === 'whoami') {
      const whoToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
      if (whoToken.length === 0) {
        return new Response(JSON.stringify({ is_admin: false, reason: 'ADMIN_UNVERIFIABLE' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const whoSignature = await verifyInitData(payload?.init_data, whoToken);
      if (!whoSignature.ok) {
        return new Response(JSON.stringify({ is_admin: false, reason: whoSignature.reason }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const owners = adminIdsFromEnv(Deno.env.get('ADMIN_TELEGRAM_IDS'), Deno.env.get('TELEGRAM_ADMIN_CHAT_ID'));
      const allowed = authorizeAdmin(whoSignature.user.id, owners);
      return new Response(JSON.stringify({
        is_admin: allowed.ok,
        user: { id: whoSignature.user.id, first_name: whoSignature.user.first_name ?? null },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'ping') return new Response(JSON.stringify({ status: 'online' }), { headers: corsHeaders });
    
    return new Response(JSON.stringify({ error: 'UNKNOWN_ACTION' }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
