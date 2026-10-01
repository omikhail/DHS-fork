/**
 * OllamaSearchProvider: WebSearchProvider for Ollama Cloud POST /api/web_search.
 *
 * @module @mikhail/dsh-web-search-ollama/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'

export const OLLAMA_PROVIDER_ID = 'ollama'
export const OLLAMA_DEFAULT_BASE_URL = 'https://ollama.com'
export const OLLAMA_MAX_RESULTS_CAP = 10

const USER_AGENT = 'deepseek-harness/0.0.1'

/**
 * @typedef {Object} OllamaHttpLeaseService
 * @property {() => boolean} isLeaseConfigured
 * @property {(operation: 'web-search' | 'llm-stream', fn: () => Promise<T>) => Promise<T>} runWithLease
 * @template T
 */

/**
 * @typedef {Object} OllamaSearchProviderOptions
 * @property {string} apiKey
 * @property {string} baseURL
 * @property {number} [numResults]
 * @property {'auto' | 'env' | 'lease'} [keySource]
 * @property {() => OllamaHttpLeaseService | undefined} [getOllamaHttpLease]
 * @property {() => Promise<string | undefined>} [resolveApiKey]
 */

export function mapOllamaResult(result) {
  const snippet = result.content
  if (snippet === undefined || snippet === null || String(snippet).trim().length === 0) {
    return undefined
  }
  return {
    url: result.url,
    ...(result.title != null && result.title.length > 0 ? { title: result.title } : {}),
    snippet: String(snippet),
  }
}

export function mapOllamaResponse(response) {
  const sources = (response.results ?? [])
    .map(mapOllamaResult)
    .filter((source) => source !== undefined)
  return { sources, truncated: false }
}

export class OllamaSearchProvider {
  id = OLLAMA_PROVIDER_ID

  /** @param {OllamaSearchProviderOptions} options */
  constructor(options) {
    this.options = options
  }

  /** @returns {OllamaHttpLeaseService | undefined} */
  #activeLeaseService() {
    return this.options.getOllamaHttpLease?.()
  }

  /** @param {OllamaHttpLeaseService | undefined} lease */
  #shouldUseLease(lease) {
    const keySource = this.options.keySource ?? 'auto'
    if (keySource === 'env') return false
    if (!lease?.isLeaseConfigured()) return false
    return keySource === 'lease' || keySource === 'auto'
  }

  available() {
    if (!URL.canParse(this.options.baseURL)) return false
    if (this.options.apiKey.length > 0) return true
    if (this.#activeLeaseService()?.isLeaseConfigured()) return true
    return false
  }

  /**
   * @param {{ query: string, maxResults?: number }} request
   * @param {AbortSignal} [signal]
   */
  async search(request, signal) {
    const lease = this.#activeLeaseService()
    if (this.#shouldUseLease(lease) && this.options.resolveApiKey) {
      return lease.runWithLease(
        'web-search',
        () => this.searchWithKey(request, signal),
      )
    }
    return this.searchWithKey(request, signal)
  }

  /**
   * @param {{ query: string, maxResults?: number }} request
   * @param {AbortSignal} [signal]
   */
  async searchWithKey(request, signal) {
    const apiKey = this.options.resolveApiKey
      ? await this.options.resolveApiKey()
      : this.options.apiKey
    if (apiKey === undefined || apiKey.length === 0) {
      throw new WebError('Ollama search credential is missing', 'WEB_PROVIDER_CREDENTIAL_MISSING')
    }

    const maxResults = Math.min(
      request.maxResults ?? this.options.numResults ?? 5,
      OLLAMA_MAX_RESULTS_CAP,
    )

    let response
    try {
      response = await fetch(`${this.options.baseURL}/api/web_search`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'user-agent': USER_AGENT,
        },
        body: JSON.stringify({
          query: request.query,
          max_results: maxResults,
        }),
        ...(signal !== undefined ? { signal } : {}),
      })
    } catch (error) {
      if (isAbortError(error)) {
        throw new WebError('Ollama search aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(`Ollama search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      const status = response.status
      let message = `Ollama API error (HTTP ${status})`
      try {
        const parsed = await response.json()
        const detail = parsed.error ?? parsed.message
        if (detail !== undefined && detail.length > 0) message = detail
      } catch (error) {
        if (isAbortError(error)) {
          throw new WebError('Ollama search aborted', 'WEB_ABORTED', { cause: error })
        }
      }
      throw new WebError(message, 'WEB_PROVIDER_ERROR')
    }

    try {
      const payload = await response.json()
      return mapOllamaResponse(payload)
    } catch (error) {
      if (isAbortError(error)) {
        throw new WebError('Ollama search aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(`Ollama returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError'
}
