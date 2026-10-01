import { LeaseError } from './errors.js'

/**
 * @param {string} message
 * @param {boolean} retryable
 */
function retryableLeaseError(message, retryable) {
  const error = new LeaseError('LEASE_HTTP_ERROR', message)
  error.retryable = retryable
  return error
}

/**
 * @typedef {object} LeaseApiClientConfig
 * @property {string} baseURL
 * @property {string} path
 * @property {string} tokenHeader
 * @property {() => string | undefined} getToken
 * @property {number} timeoutMs
 * @property {number} acquireRetries
 * @property {number} acquireRetryDelayMs
 * @property {typeof fetch} [fetchImpl]
 */

/**
 * @typedef {object} AcquiredLease
 * @property {string} id
 * @property {string} label
 * @property {string} secret
 * @property {number | undefined} lockSeconds
 */

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * HTTP client for Spyder Ollama key lease (POST only, v1).
 */
export class LeaseApiClient {
  /**
   * @param {LeaseApiClientConfig} config
   */
  constructor(config) {
    this.baseURL = config.baseURL.replace(/\/$/, '')
    this.path = config.path.startsWith('/') ? config.path : `/${config.path}`
    this.tokenHeader = config.tokenHeader
    this.getToken = config.getToken
    this.timeoutMs = config.timeoutMs
    this.acquireRetries = config.acquireRetries
    this.acquireRetryDelayMs = config.acquireRetryDelayMs
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch
  }

  /**
   * @returns {Promise<AcquiredLease>}
   */
  async acquire() {
    const token = this.getToken()
    if (token === undefined || token.length === 0) {
      throw new LeaseError('LEASE_TOKEN_MISSING', 'ollama lease token is not configured')
    }

    let lastError
    for (let attempt = 0; attempt <= this.acquireRetries; attempt += 1) {
      try {
        return await this.acquireOnce(token)
      } catch (error) {
        if (error instanceof LeaseError) {
          if (!this.isRetryable(error)) throw error
          lastError = error
        } else {
          const wrapped = retryableLeaseError('ollama lease request failed', true)
          wrapped.cause = error
          lastError = wrapped
        }
      }
      if (attempt < this.acquireRetries) {
        await delay(this.acquireRetryDelayMs)
      }
    }
    throw lastError ?? new LeaseError('LEASE_HTTP_ERROR', 'ollama lease acquire exhausted retries')
  }

  /**
   * @param {LeaseError} error
   */
  isRetryable(error) {
    if (!(error instanceof LeaseError)) return false
    if (error.code === 'LEASE_TIMEOUT') return true
    if (error.code === 'LEASE_HTTP_ERROR') return error.retryable === true
    return false
  }

  /**
   * @param {string} token
   * @returns {Promise<AcquiredLease>}
   */
  async acquireOnce(token) {
    const url = `${this.baseURL}${this.path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          [this.tokenHeader]: token,
        },
        signal: controller.signal,
      })
      if (response.status === 401 || response.status === 403) {
        throw retryableLeaseError(
          `ollama lease rejected token (HTTP ${response.status})`,
          false,
        )
      }
      if (response.status >= 500) {
        throw retryableLeaseError(
          `ollama lease server error (HTTP ${response.status})`,
          true,
        )
      }
      if (!response.ok) {
        throw retryableLeaseError(
          `ollama lease failed (HTTP ${response.status})`,
          false,
        )
      }
      let body
      try {
        body = await response.json()
      } catch (parseError) {
        throw new LeaseError('LEASE_INVALID_RESPONSE', 'ollama lease response is not JSON', parseError)
      }
      const key = body?.key
      if (typeof key !== 'string' || key.length === 0) {
        throw new LeaseError('LEASE_INVALID_RESPONSE', 'ollama lease response missing non-empty "key"')
      }
      const id = body.id !== undefined && body.id !== null ? String(body.id) : 'unknown'
      const label = body.label !== undefined && body.label !== null ? String(body.label) : id
      const lockSeconds = typeof body.lock_seconds === 'number' ? body.lock_seconds : undefined
      return { id, label, secret: key, lockSeconds }
    } catch (error) {
      if (error instanceof LeaseError) throw error
      if (error?.name === 'AbortError') {
        throw new LeaseError('LEASE_TIMEOUT', `ollama lease timed out after ${this.timeoutMs}ms`, error)
      }
      const wrapped = retryableLeaseError('ollama lease network error', true)
      wrapped.cause = error
      throw wrapped
    } finally {
      clearTimeout(timer)
    }
  }
}
