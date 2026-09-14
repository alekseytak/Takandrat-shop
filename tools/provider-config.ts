/** Конфигурация провайдеров контента. Новый сервис добавляется строкой. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type Capability = 'image' | 'video' | 'voice'

export type Provider = {
  name: string
  baseURL: string
  capabilities: Capability[]
  apiKeyEnv: string
  enabled?: boolean
}

export type ProviderConfig = { providers: Provider[] }

const CAPABILITIES: Capability[] = ['image', 'video', 'voice']

const isCapability = (value: unknown): value is Capability =>
  typeof value === 'string' && CAPABILITIES.includes(value as Capability)

const validateProvider = (entry: unknown, index: number): Provider => {
  if (!entry || typeof entry !== 'object') throw new Error(`провайдер ${index} не объект`)
  const p = entry as Record<string, unknown>
  if (typeof p.name !== 'string' || !p.name) throw new Error(`провайдер ${index} без имени`)
  if (typeof p.baseURL !== 'string' || !p.baseURL) throw new Error(`провайдер ${p.name} без адреса`)
  if (!Array.isArray(p.capabilities) || p.capabilities.length === 0 || !p.capabilities.every(isCapability)) {
    throw new Error(`провайдер ${p.name} без корректных capabilities (image/video/voice)`)
  }
  if (typeof p.apiKeyEnv !== 'string' || !p.apiKeyEnv) throw new Error(`провайдер ${p.name} без имени переменной ключа`)
  if (p.enabled !== undefined && typeof p.enabled !== 'boolean') throw new Error(`провайдер ${p.name}: enabled должен быть boolean`)
  return { name: p.name, baseURL: p.baseURL, capabilities: p.capabilities as Capability[], apiKeyEnv: p.apiKeyEnv, enabled: p.enabled }
}

/** Разбор конфигурации из строки. Проверяет форму и отклоняет мусор. */
export const parseProviders = (raw: string): Provider[] => {
  const data = JSON.parse(raw) as unknown
  if (!data || typeof data !== 'object' || !Array.isArray((data as ProviderConfig).providers)) {
    throw new Error('конфиг должен быть объектом с полем providers[]')
  }
  return (data as ProviderConfig).providers.map(validateProvider)
}

/** Загрузка из JSON-файла. */
export const loadProviders = (path = 'content/providers.json'): Provider[] =>
  parseProviders(readFileSync(resolve(path), 'utf8'))

/**


/** Включённые провайдеры, умеющие нужную вещь. */
export const providersFor = (providers: Provider[], capability: Capability): Provider[] =>
  providers.filter((p) => p.enabled !== false && p.capabilities.includes(capability))

/** Первый подходящий провайдер или undefined. */
export const providerFor = (providers: Provider[], capability: Capability): Provider | undefined =>
  providersFor(providers, capability)[0]
