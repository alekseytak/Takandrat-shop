/**
 * MCP-сервер магазина ТАК И РАТ.
 *
 * Зачем он здесь, а не в чужом проекте: магазин сам рассказывает о себе тому,
 * кто к нему подключился. Любая платформа — Дрёма, Cursor, Claude, свой агент —
 * подключается к этому файлу и получает одни и те же инструменты. Ни один
 * внешний проект не знает, как устроен магазин внутри.
 *
 * Запуск (stdio, разговор JSON-RPC построчно):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx tools/mcp-shop.ts
 *
 * Проверка без платформы:
 *   npx tsx tools/mcp-smoke.ts
 *
 * Только чтение. Изменять заказы, склад и витрину отсюда нельзя намеренно:
 * агент не должен менять состояние магазина сам, у него нет на это слова
 * владельца. Всё, что здесь есть, — это ответы на вопросы.
 */

import { createInterface } from 'node:readline'

const URL_BASE = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Ключ обходит RLS целиком, поэтому о нём говорим прямо, а не шёпотом. */
const credentialsProblem = (): string | null => {
  if (!URL_BASE) return 'не задан SUPABASE_URL'
  if (!KEY) return 'не задан SUPABASE_SERVICE_ROLE_KEY'
  return null
}

type Row = Record<string, unknown>

/** Запрос к базе служебным ключом. Ошибку возвращаем текстом, а не молчанием. */
const query = async (path: string): Promise<Row[]> => {
  const problem = credentialsProblem()
  if (problem) throw new Error(`магазин не подключён к базе: ${problem}`)
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY as string, Authorization: `Bearer ${KEY as string}` },
  })
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300)
    throw new Error(`база ответила ${response.status}: ${body}`)
  }
  return (await response.json()) as Row[]
}

const text = (value: unknown): { type: string; text: string }[] => [
  { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
]

const tools = [
  {
    name: 'shop_status',
    description:
      'Состояние магазина: доступна ли база, сколько товаров (всего и скрытых) и заказов, сколько заказов в каждом статусе.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'shop_products',
    description:
      'Товары магазина: цена, остаток, видимость на витрине. Скрытые товары не показываются, если не попросить явно.',
    inputSchema: {
      type: 'object',
      properties: {
        include_hidden: { type: 'boolean', description: 'Показать и скрытые товары тоже' },
        limit: { type: 'number', description: 'Сколько строк вернуть, по умолчанию 20' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'shop_orders',
    description:
      'Заказы магазина: номер, время, статус, сумма, покупатель и состав. Свежие сверху. Только чтение.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Только заказы в этом статусе, например new' },
        limit: { type: 'number', description: 'Сколько строк вернуть, по умолчанию 10' },
      },
      additionalProperties: false,
    },
  },
]

const limitOf = (value: unknown, fallback: number): number => {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.min(Math.floor(number), 200)
}

const callTool = async (name: string, args: Row): Promise<string> => {
  if (name === 'shop_status') {
    const products = await query('products?select=id,is_visible,stock_quantity')
    const orders = await query('orders?select=id,status,total_price,created_at')
    const byStatus: Record<string, number> = {}
    for (const order of orders) {
      const status = String(order.status ?? 'без статуса')
      byStatus[status] = (byStatus[status] ?? 0) + 1
    }
    const visible = products.filter((product) => product.is_visible === true).length
    const outOfStock = products.filter((product) => Number(product.stock_quantity) <= 0).length
    return [
      'магазин на связи',
      `товаров: ${products.length}, из них на витрине: ${visible}, без остатка: ${outOfStock}`,
      `заказов: ${orders.length}`,
      Object.keys(byStatus).length > 0
        ? `по статусам: ${Object.entries(byStatus).map(([s, n]) => `${s} — ${n}`).join(', ')}`
        : 'заказов пока нет',
    ].join('\n')
  }

  if (name === 'shop_products') {
    const includeHidden = args.include_hidden === true
    const limit = limitOf(args.limit, 20)
    const filter = includeHidden ? '' : '&is_visible=eq.true'
    const rows = await query(
      `products?select=id,name,price,stock_quantity,is_visible,category&order=id${filter}&limit=${limit}`,
    )
    if (rows.length === 0) return includeHidden ? 'товаров нет' : 'на витрине нет видимых товаров'
    return rows
      .map(
        (row) =>
          `#${row.id} ${row.name} — ${row.price} ₽, остаток ${row.stock_quantity}` +
          `${row.category ? `, ${row.category}` : ''}${row.is_visible === true ? '' : ' (скрыт)'}`,
      )
      .join('\n')
  }

  if (name === 'shop_orders') {
    const limit = limitOf(args.limit, 10)
    const status = typeof args.status === 'string' && args.status ? `&status=eq.${encodeURIComponent(args.status)}` : ''
    const rows = await query(
      `orders?select=id,created_at,status,total_price,customer_name,items,payment_method&order=created_at.desc${status}&limit=${limit}`,
    )
    if (rows.length === 0) return 'заказов нет'
    return rows
      .map((row) => {
        const items = Array.isArray(row.items) ? row.items.length : 0
        return `#${row.id} ${row.created_at} — ${row.status}, ${row.total_price} ₽, позиций: ${items}, оплата: ${row.payment_method}, покупатель: ${row.customer_name ?? 'не указан'}`
      })
      .join('\n')
  }

  throw new Error(`неизвестный инструмент ${name}; есть: ${tools.map((tool) => tool.name).join(', ')}`)
}

const reply = (id: unknown, result: unknown): void => {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`)
}

const fail = (id: unknown, message: string): void => {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } })}\n`)
}

const lines = createInterface({ input: process.stdin })

lines.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let message: { id?: unknown; method?: string; params?: Record<string, unknown> }
  try {
    message = JSON.parse(trimmed)
  } catch {
    return
  }
  const { id, method } = message

  // Уведомления ответа не требуют.
  if (method === 'notifications/initialized' || method === 'initialized') return
  if (id === undefined) return

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'tak-i-rat-shop', version: '1.0.0' },
    })
    return
  }

  if (method === 'ping') {
    reply(id, {})
    return
  }

  if (method === 'tools/list') {
    reply(id, { tools })
    return
  }

  if (method === 'tools/call') {
    const params = message.params ?? {}
    const name = String(params.name ?? '')
    const args = (params.arguments ?? {}) as Row
    callTool(name, args)
      .then((result) => reply(id, { content: text(result) }))
      .catch((error: Error) => reply(id, { content: text(`ошибка: ${error.message}`), isError: true }))
    return
  }

  fail(id, `метод ${method} не поддерживается`)
})

// Диагностику пишем в stderr: stdout занят протоколом.
process.stderr.write(
  credentialsProblem()
    ? `mcp-shop: запущен без доступа к базе (${credentialsProblem()})\n`
    : 'mcp-shop: запущен, доступ к базе есть\n',
)
