/**
 * Единый слой LLM-провайдеров: OpenRouter и LiteRouter.
 *
 * Оба — OpenAI-совместимые: разница только в адресе, ключе и списке моделей.
 * Google GenAI / Gemini (SDK `@google/genai`) выпилен полностью — см. AGENTS.md.
 *
 * LiteRouter отдаёт только бесплатные модели (`:free`) и режет входной контекст,
 * поэтому годится для коротких задач. Порядок: OpenRouter первым, LiteRouter
 * запасным.
 */

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatMessage = {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ProviderId = 'openrouter' | 'literouter';

export type Provider = {
  id: ProviderId;
  label: string;
  baseUrl: string;
  apiKey: string;
  /** Модели в порядке предпочтения. */
  models: string[];
};

export type ChatResult = {
  content: string | null;
  toolCalls: ToolCall[];
  model: string;
  provider: ProviderId;
};

/** Бесплатные модели OpenRouter — те, что уже работали в магазине. */
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3-8b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
];

/** Бесплатные модели LiteRouter. Сверено с /v1/models 19.09 — суффикс :free. */
const LITEROUTER_MODELS = [
  'deepseek-v3.1:free',
  'deepseek-v3.2:free',
  'glm-5.2:free',
  'mistral-large-3:free',
  'qwen3.8-27b:free',
];

/** Настроенные провайдеры в порядке приоритета. Ключи — только из окружения. */
export function providers(): Provider[] {
  const list: Provider[] = [];
  const openrouter = (process.env.OPENROUTER_API_KEY || '').trim();
  const literouter = (process.env.LITEROUTER_API_KEY || '').trim();
  if (openrouter) {
    list.push({
      id: 'openrouter',
      label: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: openrouter,
      models: OPENROUTER_MODELS,
    });
  }
  if (literouter) {
    list.push({
      id: 'literouter',
      label: 'LiteRouter',
      baseUrl: 'https://api.literouter.com/v1/chat/completions',
      apiKey: literouter,
      models: LITEROUTER_MODELS,
    });
  }
  return list;
}

/** Один вызов конкретной модели. Бросает ошибку с причиной провайдера. */
export async function chatCompletion(
  provider: Provider,
  opts: { messages: ChatMessage[]; temperature?: number; tools?: ToolDef[]; model?: string },
): Promise<ChatResult> {
  const model = opts.model || provider.models[0];
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (provider.id === 'openrouter') {
    headers['HTTP-Referer'] = process.env.FRONTEND_URL || 'http://localhost:3000';
    headers['X-Title'] = 'Tak and Rat Shop Assistant';
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;

  const response = await fetch(provider.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = (data as any)?.error?.message || JSON.stringify(data);
    } catch {
      message = await response.text();
    }
    throw new Error(`${provider.label}: ${message}`);
  }

  const data = await response.json();
  const msg = data.choices?.[0]?.message ?? {};
  return {
    content: msg.content ?? null,
    toolCalls: msg.tool_calls ?? [],
    model,
    provider: provider.id,
  };
}

/**
 * Обходит настроенных провайдеров и их модели, возвращает первый ответ.
 * Если все исчерпаны — бросает ошибку с перечислением причин.
 */
export async function bestEffort(opts: {
  messages: ChatMessage[];
  temperature?: number;
  tools?: ToolDef[];
  log?: string;
}): Promise<ChatResult> {
  const list = providers();
  if (list.length === 0) {
    throw new Error('Ключи LLM не заданы: OPENROUTER_API_KEY и LITEROUTER_API_KEY отсутствуют.');
  }
  const errors: string[] = [];
  for (const provider of list) {
    for (const model of provider.models) {
      try {
        return await chatCompletion(provider, { ...opts, model });
      } catch (error: any) {
        const detail = error?.message || String(error);
        errors.push(`${provider.id}/${model}: ${detail}`);
        console.warn(`[${opts.log || 'LLM'}] ${provider.id}/${model}: ${detail}`);
      }
    }
  }
  throw new Error(`Все LLM-провайдеры исчерпали лимиты или недоступны. ${errors.join(' | ')}`);
}
