import assert from 'node:assert/strict'
import { describe, it, afterEach } from 'node:test'
import { WebError } from '@deepseek-ai/dsh-web'
import { mapOllamaResponse, OllamaSearchProvider } from '../lib/provider.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('OllamaSearchProvider', () => {
  it('available is true with static apiKey', () => {
    const p = new OllamaSearchProvider({ apiKey: 'k', baseURL: 'https://ollama.com' })
    assert.equal(p.available(), true)
  })

  it('available is true with lease configured and empty static key', () => {
    const lease = { isLeaseConfigured: () => true, runWithLease: async (_op, fn) => fn() }
    const p = new OllamaSearchProvider({
      apiKey: '',
      baseURL: 'https://ollama.com',
      getOllamaHttpLease: () => lease,
      resolveApiKey: async () => 'leased',
    })
    assert.equal(p.available(), true)
  })

  it('available becomes true when lease appears after apply (lazy get)', () => {
    let lease
    const p = new OllamaSearchProvider({
      apiKey: '',
      baseURL: 'https://ollama.com',
      getOllamaHttpLease: () => lease,
    })
    assert.equal(p.available(), false)
    lease = { isLeaseConfigured: () => true, runWithLease: async (_op, fn) => fn() }
    assert.equal(p.available(), true)
  })

  it('search uses runWithLease when lease path enabled', async () => {
    let leaseCalls = 0
    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return { results: [{ title: 't', url: 'https://x', content: 'snippet' }] }
      },
    })

    const lease = {
      isLeaseConfigured: () => true,
      runWithLease: async (_op, fn) => {
        leaseCalls += 1
        return fn()
      },
    }
    const p = new OllamaSearchProvider({
      apiKey: '',
      baseURL: 'https://ollama.com',
      keySource: 'lease',
      getOllamaHttpLease: () => lease,
      resolveApiKey: async () => 'from-lease',
    })

    const result = await p.search({ query: 'q' })
    assert.equal(leaseCalls, 1)
    assert.equal(result.sources.length, 1)
  })

  it('search uses static apiKey without lease service', async () => {
    let authHeader
    globalThis.fetch = async (_url, init) => {
      authHeader = init.headers.authorization
      return {
        ok: true,
        async json() {
          return { results: [{ title: 't', url: 'https://x', content: 'snippet' }] }
        },
      }
    }

    const p = new OllamaSearchProvider({ apiKey: 'static-key', baseURL: 'https://ollama.com' })
    await p.search({ query: 'q' })
    assert.equal(authHeader, 'Bearer static-key')
  })

  it('available is false without key or lease', () => {
    const p = new OllamaSearchProvider({ apiKey: '', baseURL: 'https://ollama.com' })
    assert.equal(p.available(), false)
  })

  it('search throws when credential is missing', async () => {
    const p = new OllamaSearchProvider({ apiKey: '', baseURL: 'https://ollama.com' })
    await assert.rejects(
      () => p.search({ query: 'q' }),
      (err) => err instanceof WebError && err.code === 'WEB_PROVIDER_CREDENTIAL_MISSING',
    )
  })

  it('search maps API error body into WebError', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      async json() {
        return { error: 'invalid key' }
      },
    })
    const p = new OllamaSearchProvider({ apiKey: 'k', baseURL: 'https://ollama.com' })
    await assert.rejects(
      () => p.search({ query: 'q' }),
      (err) => err instanceof WebError && err.message === 'invalid key',
    )
  })

  it('mapOllamaResponse drops empty snippets', () => {
    const mapped = mapOllamaResponse({
      results: [
        { url: 'https://a', content: 'ok' },
        { url: 'https://b', content: '   ' },
        { url: 'https://c', content: null },
      ],
    })
    assert.equal(mapped.sources.length, 1)
    assert.equal(mapped.sources[0].url, 'https://a')
  })
})
