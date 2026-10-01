# `@mikhail/dsh-ollama-redis-lease`

Cordis function-plugin for DeepSeek Harness: on each `llm/stream` call to provider **`ollama`**, performs **HTTP POST** to the Spyder lease API, injects the returned API key through `ctx.credentials.resolve(OLLAMA_API_KEY)`, then morlay calls Ollama Cloud. The package name is historical; **there is no Redis client in DSH**.

Requirements and design: [doc/plugins/dsh-ollama-redis-lease/tz.md](../../doc/plugins/dsh-ollama-redis-lease/tz.md), [design.md](../../doc/plugins/dsh-ollama-redis-lease/design.md).

## Install (profile `web`)

In `~/.dsh/profiles/web/package.json`:

```json
"@mikhail/dsh-ollama-redis-lease": "file:/absolute/path/to/deepseek-harness/plugins/dsh-ollama-redis-lease"
```

Add the bundle **after** `@deepseek-ai/dsh-base` and `@morlay/dsh-llm-openai-compatible`. Merge `cordis.patch.yml` from this package and set:

- `lease.baseURL` — Spyder host (example: `https://spyder-10.lighthouselabs.online`)
- `OLLAMA_LEASE_TOKEN` in env or credentials — sent as `X-Ollama-Lease-Token`
- `OLLAMA_API_KEY` is resolved from the lease response, not a static env value when the plugin is active

```sh
cd ~/.dsh/profiles/web && pnpm install
dsh --profile web --dump-config
```

## Behavior

- One **POST** `/api/ollama/keys/lease` per ollama stream (configurable path).
- v1: **no** HTTP release and **no** quarantine in DSH; lock TTL is server-side (`lock_seconds` in response, logged only).
- `allowStaticFallback: false` (default) blocks static `OLLAMA_API_KEY` when no active lease in ALS.
- Logs: `id`, `label`, `operation` (`llm-stream` | `web-search`), duration; never the leased `key` or lease token.
- Exposes `ctx.provide('ollamaHttpLease')` for `@mikhail/dsh-web-search-ollama` (`runWithLease` per `search()`).

## Bundle order

Load **`@mikhail/dsh-ollama-redis-lease` before `@mikhail/dsh-web-search-ollama`** so `ctx.get('ollamaHttpLease')` is available when web-search `apply` runs.

## Known limitations

- Long streams may outlive server `lock_seconds`; keep streams within typical lock duration or adjust server policy.
- Each `web_search` tool call may issue up to four lease POSTs when the agent runs multiple queries (v1).
- If morlay omits HTTP status on Ollama errors, DSH does not call any pool cleanup (there is none in v1).

## Tests

```sh
cd plugins/dsh-ollama-redis-lease
npm install
npm test
npm run test:coverage
```

Optional integration: set `OLLAMA_LEASE_TEST_URL` and `OLLAMA_LEASE_TOKEN` (self-skip otherwise).
