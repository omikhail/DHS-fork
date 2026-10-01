import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { LeaseError } from '../lib/errors.js'
import { registerLlmStreamBridge } from '../lib/llm-stream-bridge.js'

describe('registerLlmStreamBridge', () => {
  it('acquires once and streams for ollama provider', async () => {
    const ctx = new Context()
    let acquireCount = 0
    const leaseClient = {
      acquire: async () => {
        acquireCount += 1
        return { id: 'k1', label: 'lab', secret: 'secret', lockSeconds: 90 }
      },
    }
    registerLlmStreamBridge(ctx, {
      llmProviderId: 'ollama',
      leaseClient,
      logger: { info: () => {}, warn: () => {} },
    })

    let sawChunk = false
    async function* source() {
      sawChunk = true
      yield { type: 'finish', reason: { kind: 'stop' } }
    }

    ctx.on('llm/stream', (_options, next) => next(), { global: true })

    const wrapped = ctx.waterfall(ctx, 'llm/stream', { provider: 'ollama', model: 'm', messages: [] }, () => source())
    for await (const _chunk of wrapped) { /* drain */ }

    assert.equal(acquireCount, 1)
    assert.equal(sawChunk, true)
  })

  it('fails before morlay when acquire fails', async () => {
    const ctx = new Context()
    const leaseClient = {
      acquire: async () => {
        throw new LeaseError('LEASE_HTTP_ERROR', 'down')
      },
    }
    registerLlmStreamBridge(ctx, {
      llmProviderId: 'ollama',
      leaseClient,
      logger: { info: () => {}, warn: () => {} },
    })

    let morlayRan = false
    async function* source() {
      morlayRan = true
      yield { type: 'finish', reason: { kind: 'stop' } }
    }

    ctx.on('llm/stream', (_options, next) => next(), { global: true })

    const wrapped = ctx.waterfall(ctx, 'llm/stream', { provider: 'ollama', model: 'm', messages: [] }, () => source())
    await assert.rejects(async () => {
      for await (const _chunk of wrapped) { /* drain */ }
    })
    assert.equal(morlayRan, false)
  })

  it('passes through non-ollama providers without acquire', async () => {
    const ctx = new Context()
    let acquireCount = 0
    const leaseClient = {
      acquire: async () => {
        acquireCount += 1
        return { id: 'k1', label: 'lab', secret: 's' }
      },
    }
    registerLlmStreamBridge(ctx, {
      llmProviderId: 'ollama',
      leaseClient,
      logger: { info: () => {}, warn: () => {} },
    })

    let sawDeepseek = false
    ctx.on('llm/stream', (options, next) => {
      if (options.provider === 'deepseek') sawDeepseek = true
      return next()
    }, { global: true })

    async function* source() {
      yield { type: 'finish', reason: { kind: 'stop' } }
    }

    const wrapped = ctx.waterfall(ctx, 'llm/stream', { provider: 'deepseek', model: 'm', messages: [] }, () => source())
    for await (const _chunk of wrapped) { /* drain */ }

    assert.equal(sawDeepseek, true)
    assert.equal(acquireCount, 0)
  })
})
