/**
 * @module @mikhail/dsh-web-search-ollama
 */

import z from '@deepseek-ai/schemastery'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import {
  OllamaSearchProvider,
  OLLAMA_DEFAULT_BASE_URL,
} from './provider.js'

export {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_MAX_RESULTS_CAP,
  OLLAMA_PROVIDER_ID,
  OllamaSearchProvider,
} from './provider.js'

export const name = 'web-search-ollama'

export const inject = ['web', 'credentials']

const DEFAULT_API_KEY_ENV = 'OLLAMA_API_KEY'

/** Validated plugin config (`apiKey` / `numResults` read from raw loader config — schemastery has no `.optional()`). */
export const Config = z.object({
  apiKeyEnv: z.string().default(DEFAULT_API_KEY_ENV),
  credentialRef: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  keySource: z.union(['auto', 'env', 'lease']).default('auto'),
  baseURL: z.string().default(OLLAMA_DEFAULT_BASE_URL),
})

/**
 * @param {z.infer<typeof Config>} config
 * @param {import('./provider.js').OllamaHttpLeaseService | undefined} ollamaHttpLease
 */
function resolveLeaseMode(config, ollamaHttpLease) {
  const keySource = config.keySource ?? 'auto'
  if (keySource === 'env') return 'env'
  if (keySource === 'lease') {
    if (!ollamaHttpLease?.isLeaseConfigured()) return 'lease-unavailable'
    return 'lease'
  }
  if (ollamaHttpLease?.isLeaseConfigured()) return 'lease'
  return 'env'
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {z.infer<typeof Config>} rawConfig
 */
export function apply(ctx, rawConfig) {
  const config = Config(rawConfig)
  const apiKeyLiteral = typeof rawConfig?.apiKey === 'string' ? rawConfig.apiKey : undefined
  const numResults = typeof rawConfig?.numResults === 'number' ? rawConfig.numResults : undefined
  const getOllamaHttpLease = () => ctx.get('ollamaHttpLease')
  const mode = resolveLeaseMode(config, getOllamaHttpLease())

  if (config.keySource === 'lease' && mode === 'lease-unavailable') {
    ctx.logger.warn(
      'web-search-ollama: keySource is lease but ollamaHttpLease is missing or OLLAMA_LEASE_TOKEN is not set',
    )
  }

  const baseURL = config.baseURL ?? OLLAMA_DEFAULT_BASE_URL
  const credentialRef = config.credentialRef ?? DEFAULT_API_KEY_ENV
  const keySource = config.keySource ?? 'auto'

  let staticApiKey = ''
  if (keySource === 'env' || (keySource === 'auto' && mode === 'env')) {
    staticApiKey = apiKeyLiteral !== undefined && apiKeyLiteral.length > 0
      ? apiKeyLiteral
      : launchEnvironmentOf(ctx).get(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV)?.value ?? ''
  }

  /** @type {import('./provider.js').OllamaSearchProviderOptions} */
  const providerOptions = {
    apiKey: staticApiKey,
    baseURL,
    keySource,
    getOllamaHttpLease,
    ...(numResults !== undefined ? { numResults } : {}),
  }

  if (keySource !== 'env') {
    providerOptions.resolveApiKey = async () => {
      const resolved = await ctx.credentials.resolve(credentialRef)
      return resolved?.value
    }
  }

  const provider = new OllamaSearchProvider(providerOptions)
  ctx.web.registerSearchProvider(provider)
}
