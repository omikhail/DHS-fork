# @mikhail/dsh-web-search-ollama

Ollama Cloud web search provider for DSH (`ctx.web`). Uses `POST https://ollama.com/api/web_search` with a Bearer API key.

With `@mikhail/dsh-ollama-redis-lease` loaded **earlier** in the profile bundles, each `search()` can acquire a key via Spyder HTTP lease (`keySource: auto`, default) instead of a static `OLLAMA_API_KEY`.

Design: [doc/plugins/dsh-ollama-redis-lease/web-search-lease/design.md](../../doc/plugins/dsh-ollama-redis-lease/web-search-lease/design.md).

## Profile wiring

`~/.dsh/profiles/web/package.json` bundles (fragment):

```json
"@mikhail/dsh-ollama-redis-lease",
"@morlay/dsh-llm-openai-compatible",
"@deepseek-ai/dsh-web-app",
"@mikhail/dsh-web-search-ollama"
```

Lease bundle must appear **before** this package. Web-search loads after `@deepseek-ai/dsh-web-app`.

## Configuration

| Field | Default | Description |
|-------|---------|-------------|
| `apiKeyEnv` | `OLLAMA_API_KEY` | Env name for static key (`keySource: env` or `auto` without lease) |
| `credentialRef` | `OLLAMA_API_KEY` | Ref for `credentials.resolve` inside lease scope |
| `keySource` | `auto` | `auto` \| `env` \| `lease` |
| `baseURL` | `https://ollama.com` | API base |
| `numResults` | (unset) | Default max results (cap 10) |

### Lease-only profile

- Set `OLLAMA_LEASE_TOKEN` in `~/.dsh/.env`.
- Comment out or remove `OLLAMA_API_KEY`.
- Ensure `@mikhail/dsh-ollama-redis-lease` is in bundles before this plugin.

### Strict lease mode

`keySource: lease` — requires `ollamaHttpLease` and configured lease token; warns and stays unavailable otherwise.

## Tests

```sh
cd plugins/dsh-web-search-ollama
npm install
npm test
```
