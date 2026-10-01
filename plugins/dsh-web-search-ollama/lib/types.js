/**
 * Wire types for the Ollama Cloud web search API
 * (POST https://ollama.com/api/web_search).
 *
 * @module @mikhail/dsh-web-search-ollama/types
 */

/**
 * @typedef {Object} OllamaSearchRequest
 * @property {string} query
 * @property {number} [max_results]
 */

/**
 * @typedef {Object} OllamaSearchResult
 * @property {string} title
 * @property {string} url
 * @property {string} content
 */

/**
 * @typedef {Object} OllamaSearchResponse
 * @property {OllamaSearchResult[]} [results]
 */
