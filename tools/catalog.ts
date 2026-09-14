/**
 * Версии каталога: что сейчас, что было, и откат без потерь.
 *
 *   npx tsx tools/catalog.ts status
 *   npx tsx tools/catalog.ts record --note "пересъёмка ch-01"
 *   npx tsx tools/catalog.ts rollback v1
 *
 * Откат двигает указатель и ничего не удаляет: файлы каталога и все версии
 * остаются на месте, поэтому откатиться назад можно в любой момент и снова
 * вернуться вперёд.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PRODUCTS } from '../src/constants'
import {
  emptyRegistry,
  parseRegistry,
  publishVersion,
  rollback,
  serializeRegistry,
  describeRegistry,
  type Registry,
} from './catalog-registry'

const REGISTRY_FILE = resolve('content/catalog.json')

/** Снимок того, что каталог показывает сейчас. */
const snapshot = (): Record<string, string[]> =>
  Object.fromEntries(
    PRODUCTS.map((product) => [
      product.id,
      (product.images ?? []).map((image) => image.replace('/products/', '')),
    ]),
  )

/** Нет файла — нет версий. Это не ошибка, а начало работы. */
const read = (): Registry =>
  existsSync(REGISTRY_FILE) ? parseRegistry(readFileSync(REGISTRY_FILE, 'utf8')) : emptyRegistry()

const write = (registry: Registry): void => {
  mkdirSync(dirname(REGISTRY_FILE), { recursive: true })
  writeFileSync(REGISTRY_FILE, serializeRegistry(registry))
}

const args = process.argv.slice(2)
const command = args[0] ?? 'status'
const value = (name: string, fallback: string): string => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

try {
  if (command === 'status' || command === 'versions') {
    console.log(describeRegistry(read()))
  } else if (command === 'record') {
    const registry = read()
    const updated = publishVersion(registry, {
      products: snapshot(),
      note: value('--note', 'снимок каталога'),
      at: new Date().toISOString(),
    })
    write(updated)
    console.log(`записана версия ${updated.current}`)
    console.log(describeRegistry(updated))
  } else if (command === 'rollback') {
    const id = args[1]
    if (!id) throw new Error('укажите версию: npx tsx tools/catalog.ts rollback v1')
    const result = rollback(read(), id)
    write(result.registry)
    console.log(`указатель возвращён: ${result.from?.id ?? 'не выбрано'} → ${result.to.id}`)
    if (result.restored.length > 0) console.log(`вернётся на витрину: ${result.restored.join(', ')}`)
    if (result.hidden.length > 0) console.log(`уйдёт с витрины: ${result.hidden.join(', ')}`)
    console.log('ни один файл и ни одна версия при откате не удалены')
  } else {
    console.log('команды: status, record, rollback')
    process.exitCode = 2
  }
} catch (error) {
  console.error(`ошибка: ${(error as Error).message}`)
  process.exitCode = 1
}
