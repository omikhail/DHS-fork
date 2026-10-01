/**
 * Local smoke: real HTTP lease + llm/stream bridge (no full DSH UI).
 * Usage: set -a && source ~/.dsh/.env && set +a && node scripts/local-lease-smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { LeaseApiClient } from '../lib/lease-api-client.js'
import { registerLlmStreamBridge } from '../lib/llm-stream-bridge.js'

function loadEnvToken() {
  const path = join(homedir(), '.dsh', '.env')
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const m = /^OLLAMA_LEASE_TOKEN=(.*)$/.exec(line.trim())
    if (m) return m[1]
  }
  throw new Error('OLLAMA_LEASE_TOKEN not in ~/.dsh/.env')
}

const token = loadEnvToken()
const leaseClient = new LeaseApiClient({
  baseURL: 'https://spyder-10.lighthouselabs.online',
  path: '/api/ollama/keys/lease',
  tokenHeader: 'X-Ollama-Lease-Token',
  getToken: () => token,
  timeoutMs: 30_000,
  acquireRetries: 2,
  acquireRetryDelayMs: 200,
})

const logger = {
  info: (fmt, ...args) => console.log(fmt, ...args),
  warn: (fmt, ...args) => console.warn(fmt, ...args),
}

async function oneStream(label) {
  const ctx = new Context()
  registerLlmStreamBridge(ctx, {
    llmProviderId: 'ollama',
    leaseClient,
    logger,
  })
  ctx.on('llm/stream', (_options, next) => next(), { global: true })
  async function* source() {
    yield { type: 'text-delta', textDelta: label }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
  const stream = ctx.waterfall(
    ctx,
    'llm/stream',
    { provider: 'ollama', model: 'gpt-oss:20b', messages: [] },
    () => source(),
  )
  for await (const _chunk of stream) { /* drain */ }
}

for (let i = 0; i < 3; i += 1) {
  await oneStream(`smoke-${i}`)
}
console.log('local-lease-smoke: done (check log lines for acquired id=)')
