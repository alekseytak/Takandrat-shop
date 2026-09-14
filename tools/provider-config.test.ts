import { loadProviders, parseProviders, providersFor, providerFor } from './provider-config'

let passed = 0
const failures: string[] = []
const check = (name: string, run: () => void): void => {
  try { run(); passed += 1; console.log(`  ок  ${name}`) }
  catch (e) { failures.push(`${name}: ${(e as Error).message}`); console.log(`  НЕТ ${name}: ${(e as Error).message}`) }
}
const expect = (c: boolean, m: string): void => { if (!c) throw new Error(m) }
const expectThrow = (run: () => unknown, contains: string): void => {
  try { run() } catch (e) { const m = (e as Error).message; if (!m.includes(contains)) throw new Error(`ожидалось «${contains}», пришло «${m}»`); return }
  throw new Error(`ожидалась ошибка «${contains}»`)
}

console.log('конфигурация провайдеров')

check('загружается пример без дублей', () => {
  const providers = loadProviders('content/providers.example.json')
  expect(providers.length === 2, `должно быть 2, а не ${providers.length}`)
})

check('фильтр по image', () => {
  const providers = loadProviders('content/providers.example.json')
  expect(providersFor(providers, 'image').length === 1, 'image должен быть у одного')
  expect(providerFor(providers, 'image')?.name === 'oneprovider', 'image — oneprovider')
})

check('video и voice отключены по умолчанию', () => {
  const providers = loadProviders('content/providers.example.json')
  expect(providersFor(providers, 'video').length === 0, 'video-провайдер выключен')
  expect(providersFor(providers, 'voice').length === 0, 'voice-провайдер выключен')
})

check('включённый провайдер находится', () => {
  const providers = loadProviders('content/providers.example.json')
  const found = providersFor(providers, 'image')
  expect(found.length === 1 && found[0].enabled !== false, 'oneprovider включён')
})

check('отсутствующий файл — ошибка', () => {
  expectThrow(() => loadProviders('content/nope.json'), 'ENOENT')
})

check('мусорный JSON отклоняется', () => {
  expectThrow(() => parseProviders('{"providers":[{"name":"x","baseURL":"https://x","apiKeyEnv":"X","capabilities":["bad"]}]}'), 'capabilities')
  expectThrow(() => parseProviders('{"providers":"не массив"}'), 'конфиг должен быть объектом')
})

console.log(`\nвсего проверок: ${passed + failures.length}, прошло: ${passed}, провалилось: ${failures.length}`)
if (failures.length) { for (const f of failures) console.log(`провал: ${f}`); process.exitCode = 1 }
