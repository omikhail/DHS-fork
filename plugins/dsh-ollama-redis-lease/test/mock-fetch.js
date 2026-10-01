/**
 * @typedef {{ url: string, init: RequestInit }} FetchCall
 */

/**
 * @param {Array<{ status: number, body?: unknown, delayMs?: number, reject?: Error }>} responses
 */
export function createMockFetch(responses) {
  /** @type {FetchCall[]} */
  const calls = []
  let index = 0

  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init })
    const spec = responses[index] ?? responses[responses.length - 1]
    index += 1
    if (spec.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, spec.delayMs))
    }
    if (spec.reject) throw spec.reject
    const body = spec.body !== undefined ? JSON.stringify(spec.body) : ''
    return {
      status: spec.status,
      ok: spec.status >= 200 && spec.status < 300,
      async json() {
        return typeof spec.body === 'string' ? JSON.parse(spec.body) : spec.body
      },
    }
  }

  return { fetchImpl, calls }
}
