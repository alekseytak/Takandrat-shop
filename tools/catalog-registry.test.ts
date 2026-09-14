/**
 * Проверки реестра версий каталога.
 *
 * Запуск: npm run check:catalog
 *
 * Главное свойство, которое здесь стерегут: откат возвращает указатель, но
 * ничего не теряет. Если проверку «после отката обе версии на месте» убрать,
 * файл перестаёт ловить откат, который стирает историю.
 */

import {
  emptyRegistry,
  parseRegistry,
  publishVersion,
  rollback,
  describeRegistry,
  serializeRegistry,
  type Registry,
} from './catalog-registry'

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

const expectThrow = (run: () => unknown, contains: string): void => {
  try {
    run()
  } catch (error) {
    const message = (error as Error).message
    if (!message.includes(contains)) throw new Error(`ожидалась ошибка «${contains}», пришла «${message}»`)
    return
  }
  throw new Error(`ожидалась ошибка «${contains}», но вызов прошёл`)
}

const twoProducts = (second: string[]): Record<string, string[]> => ({
  'ch-01': ['01.jpg', '02.jpg'],
  'ch-02': second,
})

const withFirst = (): Registry =>
  publishVersion(emptyRegistry(), { products: twoProducts(['03.jpg']), note: 'первая публикация', at: '2026-09-14T10:00:00Z' })

console.log('реестр версий каталога')

check('пустой реестр ничего не обещает', () => {
  const registry = emptyRegistry()
  expect(registry.current === null, 'у пустого реестра указатель должен быть пустым')
  expect(registry.versions.length === 0, 'версий быть не должно')
  expect(describeRegistry(registry) === 'каталог ещё не публиковался', 'сводка пустого реестра')
})

check('публикация записывает снимок и переводит указатель', () => {
  const registry = withFirst()
  expect(registry.current === 'v1', `указатель должен стать v1, стал ${registry.current}`)
  expect(registry.versions.length === 1, 'должна появиться одна версия')
  expect(registry.versions[0].products['ch-01'].length === 2, 'снимок должен помнить оба фото первого товара')
})

check('вторая публикация не трогает первую', () => {
  const first = withFirst()
  const second = publishVersion(first, { products: twoProducts(['04.jpg']), note: 'вторая', at: '2026-09-14T11:00:00Z' })
  expect(second.current === 'v2', `указатель должен стать v2, стал ${second.current}`)
  expect(first.current === 'v1', 'входной реестр меняться не должен')
  expect(first.versions.length === 1, 'у входного реестра не должно появиться версий')
  expect(second.versions.length === 2, 'у нового реестра должно быть две версии')
  expect(second.versions[0].products['ch-02'][0] === '03.jpg', 'первая версия должна остаться прежней')
})

check('номер версии не переиспользуется после отката', () => {
  const first = withFirst()
  const second = publishVersion(first, { products: twoProducts(['04.jpg']), note: 'вторая', at: '2026-09-14T11:00:00Z' })
  const back = rollback(second, 'v1').registry
  const third = publishVersion(back, { products: twoProducts(['05.jpg']), note: 'третья', at: '2026-09-14T12:00:00Z' })
  expect(third.current === 'v3', `после отката новая версия должна быть v3, стала ${third.current}`)
  expect(third.versions.length === 3, 'история не должна терять вторую версию')
})

check('откат двигает указатель и ничего не удаляет', () => {
  const first = withFirst()
  const second = publishVersion(first, { products: twoProducts(['04.jpg']), note: 'вторая', at: '2026-09-14T11:00:00Z' })
  const result = rollback(second, 'v1')
  expect(result.registry.current === 'v1', `указатель должен вернуться на v1, стал ${result.registry.current}`)
  expect(result.to.id === 'v1', 'должны вернуться на v1')
  expect(result.from?.id === 'v2', 'должны вернуться с v2')
  expect(result.registry.versions.length === 2, 'после отката обе версии обязаны остаться')
  expect(result.hidden.join() === '04.jpg', `скроется 04.jpg, а не ${result.hidden.join()}`)
  expect(result.restored.join() === '03.jpg', `вернётся 03.jpg, а не ${result.restored.join()}`)
})

check('откат на текущую версию ничего не меняет', () => {
  const second = publishVersion(withFirst(), { products: twoProducts(['04.jpg']), note: 'вторая', at: '2026-09-14T11:00:00Z' })
  const result = rollback(second, 'v2')
  expect(result.registry.current === 'v2', 'указатель должен остаться на v2')
  expect(result.restored.length === 0 && result.hidden.length === 0, 'меняться нечему')
})

check('откат на несуществующую версию отклоняется', () => {
  expectThrow(() => rollback(withFirst(), 'v9'), 'нет версии v9')
})

check('откат называет, какие версии есть', () => {
  expectThrow(() => rollback(withFirst(), 'нет такой'), 'есть: v1')
})

check('версия без товаров не записывается', () => {
  expectThrow(() => publishVersion(emptyRegistry(), { products: {}, note: 'пусто', at: '2026-09-14T10:00:00Z' }), 'без товаров')
})

check('товар без фото не записывается', () => {
  expectThrow(
    () => publishVersion(emptyRegistry(), { products: { 'ch-01': [] }, note: 'дыра', at: '2026-09-14T10:00:00Z' }),
    'нет ни одного фото',
  )
})

check('файл реестра переживает запись и чтение', () => {
  const second = publishVersion(withFirst(), { products: twoProducts(['04.jpg']), note: 'вторая', at: '2026-09-14T11:00:00Z' })
  const restored = parseRegistry(serializeRegistry(second))
  expect(restored.current === 'v2', 'указатель должен пережить круг')
  expect(restored.versions.length === 2, 'версии должны пережить круг')
  expect(restored.versions[1].products['ch-02'][0] === '04.jpg', 'снимок второй версии должен пережить круг')
  expect(restored.versions[1].note === 'вторая', 'пометка должна пережить круг')
})

check('мусор вместо реестра отклоняется', () => {
  expectThrow(() => parseRegistry('не json'), 'не читается как JSON')
  expectThrow(() => parseRegistry('[]'), 'не той формы')
  expectThrow(() => parseRegistry('{"versions":[{"products":{}}]}'), 'без id')
  expectThrow(() => parseRegistry('{"versions":[{"id":"v1"}]}'), 'без снимка товаров')
  expectThrow(() => parseRegistry('{"versions":[{"id":"v1","products":{"ch-01":"01.jpg"}}]}'), 'не список строк')
})

check('указатель на несуществующую версию отклоняется', () => {
  expectThrow(() => parseRegistry('{"current":"v7","versions":[{"id":"v1","products":{"ch-01":["01.jpg"]}}]}'), 'несуществующую версию')
})

check('реестр без указателя читается как «не выбрано»', () => {
  const registry = parseRegistry('{"versions":[{"id":"v1","products":{"ch-01":["01.jpg"]}}]}')
  expect(registry.current === null, 'пустой указатель должен читаться как null')
})

check('сводка показывает текущую версию и историю', () => {
  const second = publishVersion(withFirst(), { products: twoProducts(['04.jpg']), note: 'вторая', at: '2026-09-14T11:00:00Z' })
  const text = describeRegistry(second)
  expect(text.includes('сейчас: v2'), `сводка без текущей версии: ${text}`)
  expect(text.includes('всего версий: 2'), `сводка без числа версий: ${text}`)
  expect(text.includes('* v2'), 'текущая версия должна быть помечена')
  expect(text.includes('  v1'), 'прежняя версия должна быть в списке без пометки')
})

console.log(`\nвсего проверок: ${passed + failures.length}, прошло: ${passed}, провалилось: ${failures.length}`)
if (failures.length > 0) {
  for (const failure of failures) console.log(`провал: ${failure}`)
  process.exitCode = 1
}
