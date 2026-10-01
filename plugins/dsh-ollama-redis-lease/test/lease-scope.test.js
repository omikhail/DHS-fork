import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getActiveLease } from '../lib/lease-context.js'
import { runWithOllamaLease } from '../lib/lease-scope.js'

describe('runWithOllamaLease', () => {
  it('acquires once and exposes lease in ALS during fn', async () => {
    let acquireCount = 0
    const leaseClient = {
      acquire: async () => {
        acquireCount += 1
        return { id: 'a1', label: 'L', secret: 's', lockSeconds: 90 }
      },
    }
    const logs = []
    const logger = { info: (...args) => logs.push(args), warn: () => {} }

    const result = await runWithOllamaLease(
      { leaseClient, logger },
      'web-search',
      async () => {
        const lease = getActiveLease()
        assert.equal(lease?.secret, 's')
        return 'ok'
      },
    )

    assert.equal(result, 'ok')
    assert.equal(acquireCount, 1)
    assert.ok(logs.some((line) => line.includes('web-search')))
  })

  it('logs finish after fn completes', async () => {
    const leaseClient = {
      acquire: async () => ({ id: 'x', label: 'l', secret: 'k' }),
    }
    const logs = []
    await runWithOllamaLease(
      { leaseClient, logger: { info: (...a) => logs.push(a), warn: () => {} } },
      'llm-stream',
      async () => {},
    )
    assert.ok(logs.some((line) => String(line[0]).includes('finished')))
  })
})
