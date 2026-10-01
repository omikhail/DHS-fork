import { streamWithOllamaLease } from './lease-scope.js'

/**
 * @typedef {object} LlmStreamBridgeOptions
 * @property {string} llmProviderId
 * @property {{ acquire: () => Promise<import('./lease-api-client.js').AcquiredLease> }} leaseClient
 * @property {{ info: (format: string, ...args: unknown[]) => void, warn: (format: string, ...args: unknown[]) => void }} logger
 */

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {LlmStreamBridgeOptions} options
 * @returns {() => void} disposer for the waterfall listener
 */
export function registerLlmStreamBridge(ctx, options) {
  const { llmProviderId, leaseClient, logger } = options
  const scope = { leaseClient, logger }

  return ctx.on('llm/stream', async function* llmStreamLeaseBridge(optionsStream, next) {
    if (optionsStream.provider !== llmProviderId) {
      yield* next()
      return
    }
    yield* streamWithOllamaLease(scope, 'llm-stream', () => next())
  }, { prepend: true })
}
