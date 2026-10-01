import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { patchCredentialsResolve } from '../lib/credentials-delegate.js'
import { clearActiveLease, enterActiveLease } from '../lib/lease-context.js'

function mockInner() {
  return {
    async resolve(ref) {
      return { value: `static:${String(ref)}`, source: 'file' }
    },
  }
}

describe('patchCredentialsResolve', () => {
  it('returns leased secret when ALS is active', async () => {
    const inner = mockInner()
    const restore = patchCredentialsResolve(inner, {
      credentialRef: 'OLLAMA_API_KEY',
      allowStaticFallback: false,
    })
    enterActiveLease({ id: 'k1', label: 'l', secret: 'leased-secret' })
    const resolved = await inner.resolve('OLLAMA_API_KEY')
    assert.deepEqual(resolved, { value: 'leased-secret', source: 'ollama-http-lease' })
    restore()
    clearActiveLease()
  })

  it('delegates other refs to inner', async () => {
    const inner = mockInner()
    const restore = patchCredentialsResolve(inner, {
      credentialRef: 'OLLAMA_API_KEY',
      allowStaticFallback: false,
    })
    const resolved = await inner.resolve('DEEPSEEK_API_KEY')
    assert.deepEqual(resolved, { value: 'static:DEEPSEEK_API_KEY', source: 'file' })
    restore()
  })

  it('blocks static fallback when disabled and ALS empty', async () => {
    const inner = mockInner()
    const restore = patchCredentialsResolve(inner, {
      credentialRef: 'OLLAMA_API_KEY',
      allowStaticFallback: false,
    })
    clearActiveLease()
    const resolved = await inner.resolve('OLLAMA_API_KEY')
    assert.equal(resolved, undefined)
    restore()
  })

  it('allows static fallback when enabled', async () => {
    const inner = mockInner()
    const restore = patchCredentialsResolve(inner, {
      credentialRef: 'OLLAMA_API_KEY',
      allowStaticFallback: true,
    })
    clearActiveLease()
    const resolved = await inner.resolve('OLLAMA_API_KEY')
    assert.deepEqual(resolved, { value: 'static:OLLAMA_API_KEY', source: 'file' })
    restore()
  })
})
