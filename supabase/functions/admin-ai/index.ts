
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
