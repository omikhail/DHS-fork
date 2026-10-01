import z from '@deepseek-ai/schemastery'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { patchCredentialsResolve } from './credentials-delegate.js'
import { LeaseApiClient } from './lease-api-client.js'
import { createOllamaHttpLeaseService } from './lease-scope.js'
import { registerLlmStreamBridge } from './llm-stream-bridge.js'

export const name = 'ollama-redis-lease'

export const inject = ['credentials', 'llm']

const DEFAULT_LEASE_PATH = '/api/ollama/keys/lease'
const DEFAULT_TOKEN_HEADER = 'X-Ollama-Lease-Token'

export const Config = z.object({
  lease: z.object({
    baseURL: z.string(),
    path: z.string().default(DEFAULT_LEASE_PATH),
    tokenEnv: z.string().role('credential-ref'),
    tokenHeader: z.string().default(DEFAULT_TOKEN_HEADER),
    timeoutMs: z.number().step(1).min(1).default(30_000),
    acquireRetries: z.number().step(1).min(0).default(3),
    acquireRetryDelayMs: z.number().step(1).min(0).default(200),
  }),
  provider: z.object({
    credentialRef: z.string().role('credential-ref').default('OLLAMA_API_KEY'),
    llmProviderId: z.string().default('ollama'),
  }).default({}),
  allowStaticFallback: z.boolean().default(false),
})

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {z.infer<typeof Config>} config
 */
export function apply(ctx, config) {
  const resolved = Config(config)

  const tokenEnv = resolved.lease.tokenEnv
  const leaseClient = new LeaseApiClient({
    baseURL: resolved.lease.baseURL,
    path: resolved.lease.path,
    tokenHeader: resolved.lease.tokenHeader,
    getToken: () => launchEnvironmentOf(ctx).get(tokenEnv)?.value,
    timeoutMs: resolved.lease.timeoutMs,
    acquireRetries: resolved.lease.acquireRetries,
    acquireRetryDelayMs: resolved.lease.acquireRetryDelayMs,
  })

  const ollamaHttpLease = createOllamaHttpLeaseService({
    leaseClient,
    logger: ctx.logger,
    isLeaseConfigured: () => {
      const value = launchEnvironmentOf(ctx).get(tokenEnv)?.value
      return value !== undefined && value.length > 0
    },
  })

  const disposeProvide = ctx.provide('ollamaHttpLease', ollamaHttpLease)

  const inner = ctx.credentials
  const unpatchCredentials = patchCredentialsResolve(inner, {
    credentialRef: resolved.provider.credentialRef,
    allowStaticFallback: resolved.allowStaticFallback,
  })

  const disposeBridge = registerLlmStreamBridge(ctx, {
    llmProviderId: resolved.provider.llmProviderId,
    leaseClient,
    logger: ctx.logger,
  })

  ctx.effect(() => async () => {
    disposeBridge()
    unpatchCredentials()
    await disposeProvide()
  }, 'ollama-http-lease')
}
