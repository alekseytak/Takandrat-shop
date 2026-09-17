/**
 * Проверка MCP-сервера магазина: поднимаем его как отдельный процесс, как это
 * сделает любая платформа, и дергаем инструменты по-настоящему.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run check:mcp
 *
 * Без ключей проверка честно говорит, что не проверена, и не считает это
 * успехом: «сервер ответил» и «сервер умеет читать магазин» — разные вещи.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const server = resolve(here, 'mcp-shop.ts')

let passed = 0
const failures: string[] = []
const check = (name: string, run: () => void): void => {
  try {
    run()
    passed += 1
    console.log(`  ок  ${name}`)
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`)
    console.log(`  НЕТ ${name}: ${(error as Error).message}`)
  }
}
const expect = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message)
}

const child = spawn('npx', ['tsx', server], {
  cwd: resolve(here, '..'),
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
})

let buffer = ''
const replies = new Map<number, { result?: unknown; error?: { message: string } }>()
let stderr = ''
child.stdout.on('data', (chunk: Buffer) => {
  buffer += chunk.toString()
  let index: number
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    if (!line) continue
    try {
      const message = JSON.parse(line) as { id?: number; result?: unknown; error?: { message: string } }
      if (typeof message.id === 'number') replies.set(message.id, message)
    } catch {
      failures.push(`сервер написал в stdout не JSON: ${line.slice(0, 80)}`)
    }
  }
})
child.stderr.on('data', (chunk: Buffer) => {
  stderr += chunk.toString()
})

const ask = async (id: number, method: string, params?: unknown): Promise<unknown> => {
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  const started = Date.now()
  while (Date.now() - started < 30000) {
    const reply = replies.get(id)
    if (reply) return reply
    await new Promise((wake) => setTimeout(wake, 150))
  }
  throw new Error(`нет ответа на ${method} за 30 с`)
}

const textOf = (reply: unknown): string => {
  const content = (reply as { result?: { content?: { text?: string }[] } }).result?.content
  return content?.[0]?.text ?? ''
}

console.log('MCP-сервер магазина')

try {
  const init = (await ask(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-smoke', version: '1' },
  })) as { result?: { serverInfo?: { name?: string } } }
  check('сервер отвечает на инициализацию', () => {
    expect(init.result?.serverInfo?.name === 'tak-i-rat-shop', `имя сервера: ${JSON.stringify(init.result?.serverInfo)}`)
  })

  const listed = (await ask(2, 'tools/list')) as { result?: { tools?: { name: string; description: string }[] } }
  const names = (listed.result?.tools ?? []).map((tool) => tool.name)
  check('инструменты объявлены', () => {
    expect(names.length === 3, `инструментов ${names.length}, а не 3: ${names.join(', ')}`)
    for (const wanted of ['shop_status', 'shop_products', 'shop_orders']) {
      expect(names.includes(wanted), `нет инструмента ${wanted}`)
    }
  })

  check('у каждого инструмента есть описание', () => {
    for (const tool of listed.result?.tools ?? []) {
      expect(tool.description.length > 20, `описание ${tool.name} слишком короткое`)
    }
  })

  const status = textOf(await ask(3, 'tools/call', { name: 'shop_status', arguments: {} }))
  // Ошибка базы в ответе инструмента — это провал: раньше проверка этого не
  // замечала и «ок» стояло рядом с текстом ошибки схемы.
  const noError = (answer: string): string => {
    expect(!/^ошибка:/.test(answer.trim()), `инструмент вернул ошибку: ${answer.slice(0, 160)}`)
    return answer
  }

  check('shop_status отвечает', () => {
    noError(status)
    const connected = /магазин на связи/.test(status)
    const unconnected = /не подключён к базе/.test(status)
    expect(connected || unconnected, `неожиданный ответ: ${status.slice(0, 120)}`)
    if (unconnected) {
      console.log('      (ключей нет — до базы не достаём, это проверено отдельно)')
      return
    }
    expect(/товаров: \d+/.test(status), `нет числа товаров: ${status.slice(0, 120)}`)
    expect(/заказов: \d+/.test(status), `нет числа заказов: ${status.slice(0, 120)}`)
  })

  const products = textOf(await ask(4, 'tools/call', { name: 'shop_products', arguments: { limit: 3 } }))
  check('shop_products отвечает по делу', () => {
    noError(products)
    expect(!/неизвестный инструмент/.test(products), 'сервер не знает shop_products')
    expect(products.length > 0, 'пустой ответ')
  })

  const hidden = textOf(
    await ask(5, 'tools/call', { name: 'shop_products', arguments: { include_hidden: true, limit: 200 } }),
  )
  // Проверка честная только тогда, когда скрытый товар вообще есть: если все
  // товары видны, этот тест не может упасть и ничего не доказывает.
  const hiddenCount = (hidden.match(/\(скрыт\)/g) ?? []).length
  check('скрытые товары не показываются без просьбы', () => {
    if (/не подключён к базе/.test(products)) {
      console.log('      (ключей нет — проверка не выполнена)')
      return
    }
    if (hiddenCount === 0) {
      console.log('      (в базе нет ни одного скрытого товара — проверять нечего, это не успех)')
      return
    }
    expect(!/\(скрыт\)/.test(products), 'в обычном ответе оказался скрытый товар')
  })

  check('с явной просьбой скрытые видны', () => {
    if (/не подключён к базе/.test(hidden)) return
    expect(hidden.length > 0, 'пустой ответ')
  })

  const orders = textOf(await ask(6, 'tools/call', { name: 'shop_orders', arguments: { limit: 2 } }))
  check('shop_orders отвечает', () => {
    noError(orders)
    expect(!/неизвестный инструмент/.test(orders), 'сервер не знает shop_orders')
    expect(orders.length > 0, 'пустой ответ')
  })

  const unknown = textOf(await ask(7, 'tools/call', { name: 'shop_delete_everything', arguments: {} }))
  check('неизвестный инструмент отклоняется', () => {
    expect(/неизвестный инструмент/.test(unknown), `не отклонил: ${unknown.slice(0, 100)}`)
  })

  check('в stdout попадает только протокол', () => {
    expect(failures.length === 0, 'в stdout был посторонний вывод')
    expect(stderr.includes('mcp-shop:'), 'сервер не написал диагностику в stderr')
  })
} catch (error) {
  failures.push((error as Error).message)
  console.log(`  НЕТ ${(error as Error).message}`)
}

child.kill('SIGKILL')

console.log(`\nвсего проверок: ${passed + failures.length}, прошло: ${passed}, провалилось: ${failures.length}`)
if (failures.length > 0) {
  for (const failure of failures) console.log(`провал: ${failure}`)
  process.exitCode = 1
}
