import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Config } from '../lib/index.js'

describe('Config import', () => {
  it('parses empty plugin config without throwing', () => {
    const parsed = Config({})
    assert.equal(parsed.keySource, 'auto')
    assert.equal(parsed.apiKeyEnv, 'OLLAMA_API_KEY')
  })
})
