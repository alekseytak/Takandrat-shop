/**
 * Реестр версий каталога: снимки, указатель и откат без потерь.
 *
 * Правило, ради которого это существует: ни одна публикация и ни один откат не
 * удаляют и не перезаписывают уже сделанное. Версии только добавляются, а
 * «что сейчас в каталоге» — это отдельный указатель. Откат двигает указатель,
 * а не файлы, поэтому вернуться назад можно всегда, и вернуться назад снова —
 * тоже.
 *
 * Модуль чистый: те же функции проверяются в catalog-registry.test.ts без
 * файловой системы.
 */

export type ProductFiles = Record<string, string[]>

export type CatalogVersion = {
  /** Короткий человеческий номер: v1, v2, … */
  id: string
  /** Когда снят снимок, ISO. */
  at: string
  /** Чем эта версия отличается: папка черновика, причина отката и т. п. */
  note: string
  /** Какие фото были у каждого товара в этой версии. */
  products: ProductFiles
}

export type Registry = {
  /** Версия, которую видит покупатель. null — каталог ещё не публиковался. */
  current: string | null
  /** Все версии по порядку. Старые не выбрасываются никогда. */
  versions: CatalogVersion[]
}

export const emptyRegistry = (): Registry => ({ current: null, versions: [] })

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Разбор файла реестра. Мусор не превращается в пустой реестр — это ошибка. */
export const parseRegistry = (raw: string): Registry => {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (error) {
    throw new Error(`реестр не читается как JSON: ${(error as Error).message}`)
  }
  if (!isObject(data) || !Array.isArray(data.versions)) {
    throw new Error('реестр не той формы: нужен объект с полем versions')
  }
  const versions: CatalogVersion[] = data.versions.map((entry, index) => {
    if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id) {
      throw new Error(`версия ${index} без id`)
    }
    if (!isObject(entry.products)) throw new Error(`версия ${entry.id} без снимка товаров`)
    const products: ProductFiles = {}
    for (const [productId, files] of Object.entries(entry.products)) {
      if (!Array.isArray(files) || files.some((file) => typeof file !== 'string')) {
        throw new Error(`версия ${entry.id}: у товара ${productId} фото не список строк`)
      }
      products[productId] = files as string[]
    }
    return {
      id: entry.id,
      at: typeof entry.at === 'string' ? entry.at : '',
      note: typeof entry.note === 'string' ? entry.note : '',
      products,
    }
  })
  const current = data.current === null || data.current === undefined ? null : data.current
  if (current !== null && typeof current !== 'string') {
    throw new Error('поле current должно быть строкой или null')
  }
  if (current !== null && !versions.some((version) => version.id === current)) {
    throw new Error(`current указывает на несуществующую версию ${current}`)
  }
  return { current, versions }
}

export const serializeRegistry = (registry: Registry): string =>
  `${JSON.stringify(registry, null, 2)}\n`

/** Следующий свободный номер. Существующие версии не переиспользуются. */
export const nextVersionId = (registry: Registry): string => {
  const numbers = registry.versions
    .map((version) => /^v(\d+)$/.exec(version.id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number)
  return `v${Math.max(0, ...numbers) + 1}`
}

/**
 * Записать новую версию и перевести на неё указатель.
 *
 * Прошлые версии остаются нетронутыми: возвращается новый реестр, входной не
 * меняется. Публикация без снимка товаров запрещена — версия, о которой нечего
 * сказать, бесполезна при откате.
 */
export const publishVersion = (
  registry: Registry,
  input: { products: ProductFiles; note: string; at: string },
): Registry => {
  const productIds = Object.keys(input.products)
  if (productIds.length === 0) throw new Error('нельзя записать версию без товаров')
  for (const productId of productIds) {
    if (input.products[productId].length === 0) {
      throw new Error(`у товара ${productId} нет ни одного фото`)
    }
  }
  const version: CatalogVersion = {
    id: nextVersionId(registry),
    at: input.at,
    note: input.note,
    products: input.products,
  }
  return { current: version.id, versions: [...registry.versions, version] }
}

export type RollbackResult = {
  registry: Registry
  /** Куда вернулись. */
  to: CatalogVersion
  /** Откуда вернулись; null, если каталог ещё не публиковался. */
  from: CatalogVersion | null
  /** Фото, которых в текущей версии нет, а в возвращаемой были. */
  restored: string[]
  /** Фото, которых в текущей версии не будет после отката. */
  hidden: string[]
}

const filesOf = (version: CatalogVersion | null): Set<string> =>
  new Set(version ? Object.values(version.products).flat() : [])

/**
 * Откат: указатель возвращается на прежнюю версию.
 *
 * Ни один файл и ни одна версия при этом не удаляются — расхождение только
 * сообщается, чтобы человек видел, что изменится на витрине. Откат на текущую
 * версию разрешён и ничего не меняет: он идемпотентен.
 */
export const rollback = (registry: Registry, id: string): RollbackResult => {
  const to = registry.versions.find((version) => version.id === id)
  if (!to) {
    const known = registry.versions.map((version) => version.id).join(', ') || 'ни одной'
    throw new Error(`нет версии ${id}; есть: ${known}`)
  }
  const from = registry.versions.find((version) => version.id === registry.current) ?? null
  const before = filesOf(from)
  const after = filesOf(to)
  return {
    registry: { current: to.id, versions: registry.versions },
    to,
    from,
    restored: [...after].filter((file) => !before.has(file)).sort(),
    hidden: [...before].filter((file) => !after.has(file)).sort(),
  }
}

/** Человеческая сводка: что сейчас и что было. */
export const describeRegistry = (registry: Registry): string => {
  if (registry.versions.length === 0) return 'каталог ещё не публиковался'
  const lines = [`сейчас: ${registry.current ?? 'не выбрано'}, всего версий: ${registry.versions.length}`]
  for (const version of registry.versions) {
    const mark = version.id === registry.current ? '*' : ' '
    const photos = Object.values(version.products).flat().length
    lines.push(`${mark} ${version.id}  ${version.at}  фото: ${photos}  ${version.note}`)
  }
  return lines.join('\n')
}
