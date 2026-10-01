import { enterActiveLease } from './lease-context.js'

/**
 * @typedef {'llm-stream' | 'web-search'} OllamaLeaseOperation
 */

/**
 * @param {{ leaseClient: { acquire: () => Promise<import('./lease-api-client.js').AcquiredLease> }, logger: { info: Function, warn: Function } }} scope
 * @param {OllamaLeaseOperation} operation
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function runWithOllamaLease(scope, operation, fn) {
  const { leaseClient, logger } = scope
  const started = Date.now()
  let lease
  try {
    lease = await leaseClient.acquire()
    enterActiveLease(lease)
    const lockNote = lease.lockSeconds !== undefined ? ` lockSeconds=${lease.lockSeconds}` : ''
    logger.info(
      'ollama-http-lease: acquired id=%s label=%s operation=%s%s',
      lease.id,
      lease.label,
      operation,
      lockNote,
    )
    return await fn()
  } catch (error) {
    logger.warn('ollama-http-lease: failed operation=%s id=%s', operation, lease?.id ?? 'none')
    logger.warn(error)
    throw error
  } finally {
    if (lease) {
      logger.info(
        'ollama-http-lease: finished id=%s operation=%s durationMs=%d',
        lease.id,
        operation,
        Date.now() - started,
      )
    }
  }
}

/**
 * @param {{ leaseClient: { acquire: () => Promise<import('./lease-api-client.js').AcquiredLease> }, logger: { info: Function, warn: Function } }} scope
 * @param {OllamaLeaseOperation} operation
 * @param {() => AsyncIterable<unknown>} next
 */
export async function* streamWithOllamaLease(scope, operation, next) {
  const { leaseClient, logger } = scope
  const started = Date.now()
  let lease
  try {
    lease = await leaseClient.acquire()
    enterActiveLease(lease)
    const lockNote = lease.lockSeconds !== undefined ? ` lockSeconds=${lease.lockSeconds}` : ''
    logger.info(
      'ollama-http-lease: acquired id=%s label=%s operation=%s%s',
      lease.id,
      lease.label,
      operation,
      lockNote,
    )
    yield* next()
  } catch (error) {
    logger.warn('ollama-http-lease: failed operation=%s id=%s', operation, lease?.id ?? 'none')
    logger.warn(error)
    throw error
  } finally {
    if (lease) {
      logger.info(
        'ollama-http-lease: finished id=%s operation=%s durationMs=%d',
        lease.id,
        operation,
        Date.now() - started,
      )
    }
  }
}

/**
 * @param {object} options
 * @param {{ acquire: () => Promise<import('./lease-api-client.js').AcquiredLease> }} options.leaseClient
 * @param {{ info: Function, warn: Function }} options.logger
 * @param {() => boolean} options.isLeaseConfigured
 */
export function createOllamaHttpLeaseService(options) {
  const scope = { leaseClient: options.leaseClient, logger: options.logger }
  return {
    isLeaseConfigured: options.isLeaseConfigured,
    runWithLease: (operation, fn) => runWithOllamaLease(scope, operation, fn),
  }
}
