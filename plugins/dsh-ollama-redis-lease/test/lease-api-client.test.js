import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { LeaseError } from '../lib/errors.js'
import { LeaseApiClient } from '../lib/lease-api-client.js'
import { createMockFetch } from './mock-fetch.js'

function client(overrides = {}) {
  const { fetchImpl } = createMockFetch(overrides.responses ?? [{ status: 200, body: { id: '1', key: 'k', label: 'L' } }])
  return new LeaseApiClient({
    baseURL: 'https://spyder.example',
    path: '/api/ollama/keys/lease',
    tokenHeader: 'X-Ollama-Lease-Token',
    getToken: () => overrides.token ?? 'lease-token',
    timeoutMs: overrides.timeoutMs ?? 5000,
    acquireRetries: overrides.acquireRetries ?? 0,
    acquireRetryDelayMs: 1,
    fetchImpl,
  })
}

describe('LeaseApiClient', () => {
  it('returns lease on 200 JSON with key', async () => {
    const c = client({
      responses: [{ status: 200, body: { id: 'a1', key: 'secret', label: 'lab', lock_seconds: 90 } }],
    })
    const lease = await c.acquire()
    assert.equal(lease.id, 'a1')
    assert.equal(lease.secret, 'secret')
    assert.equal(lease.label, 'lab')
    assert.equal(lease.lockSeconds, 90)
  })

  it('throws LEASE_TOKEN_MISSING without token', async () => {
    const c = client({ token: '' })
    await assert.rejects(() => c.acquire(), (error) => {
      assert.ok(error instanceof LeaseError)
      assert.equal(error.code, 'LEASE_TOKEN_MISSING')
      return true
    })
  })

  it('throws LEASE_INVALID_RESPONSE when key missing', async () => {
    const c = client({ responses: [{ status: 200, body: { id: 'x' } }] })
    await assert.rejects(() => c.acquire(), (error) => {
      assert.equal(error.code, 'LEASE_INVALID_RESPONSE')
      return true
    })
  })

  it('does not retry 401', async () => {
    const { fetchImpl, calls } = createMockFetch([
      { status: 401, body: {} },
      { status: 200, body: { id: '1', key: 'k', label: 'l' } },
    ])
    const c = new LeaseApiClient({
      baseURL: 'https://spyder.example',
      path: '/lease',
      tokenHeader: 'X-Ollama-Lease-Token',
      getToken: () => 't',
      timeoutMs: 5000,
      acquireRetries: 2,
      acquireRetryDelayMs: 1,
      fetchImpl,
    })
    await assert.rejects(() => c.acquire(), (error) => {
      assert.equal(error.code, 'LEASE_HTTP_ERROR')
      return true
    })
    assert.equal(calls.length, 1)
  })

  it('retries 503 then succeeds', async () => {
    const { fetchImpl } = createMockFetch([
      { status: 503, body: {} },
      { status: 200, body: { id: '2', key: 'k2', label: 'l2' } },
    ])
    const c = new LeaseApiClient({
      baseURL: 'https://spyder.example',
      path: '/lease',
      tokenHeader: 'X-Ollama-Lease-Token',
      getToken: () => 't',
      timeoutMs: 5000,
      acquireRetries: 2,
      acquireRetryDelayMs: 1,
      fetchImpl,
    })
    const lease = await c.acquire()
    assert.equal(lease.id, '2')
  })

  it('sends POST with lease token header', async () => {
    const { fetchImpl, calls } = createMockFetch([{ status: 200, body: { id: '1', key: 'k', label: 'l' } }])
    const c = new LeaseApiClient({
      baseURL: 'https://spyder.example',
      path: '/api/ollama/keys/lease',
      tokenHeader: 'X-Ollama-Lease-Token',
      getToken: () => 'my-token',
      timeoutMs: 5000,
      acquireRetries: 0,
      acquireRetryDelayMs: 1,
      fetchImpl,
    })
    await c.acquire()
    assert.equal(calls[0].url, 'https://spyder.example/api/ollama/keys/lease')
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.headers['X-Ollama-Lease-Token'], 'my-token')
  })
})
