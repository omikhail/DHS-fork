import { describe, it } from 'node:test'

const url = process.env.OLLAMA_LEASE_TEST_URL
const token = process.env.OLLAMA_LEASE_TOKEN

describe('integration (real Spyder lease API)', { skip: !url || !token }, () => {
  it('requires OLLAMA_LEASE_TEST_URL and OLLAMA_LEASE_TOKEN', () => {
    // Manual smoke: seed env and run npm test with integration enabled.
  })
})
