# Personal DSH plugins (`@mikhail/*`)

Out-of-tree Cordis bundles for the local harness fork. Not part of upstream `packages/` or root `pnpm` workspaces.

Runnable code for each package lives in `plugins/<name>/lib/` and is **committed in git** (fresh clone + `file:` profile deps is enough; no separate publish step for ollama lease, web-search, or voice). `dsh-telegram` ships prebuilt `lib/`; optional rebuild from upstream TypeScript if you add `src/` locally.

| Package | Path | Role |
|---------|------|------|
| `@mikhail/dsh-telegram` | `dsh-telegram/` | Telegram UI (fork: voice hook, session titles, `/sessions`) |
| `@mikhail/dsh-telegram-voice` | `dsh-telegram-voice/` | Whisper STT for Telegram voice messages |
| `@mikhail/dsh-web-search-ollama` | `dsh-web-search-ollama/` | Ollama Cloud `ctx.web` search provider |
| `@mikhail/dsh-ollama-redis-lease` | `dsh-ollama-redis-lease/` | HTTP Ollama key lease via Spyder (`ctx.credentials` + `llm/stream`) |
| `@mikhail/dsh-max-userbot` | `dsh-max-userbot/` | MAX userbot front (planned); TZ in `doc/plugins/dsh-max-userbot/tz.md` |

Operational doc index: [[repo/doc/platform/services-catalog]].

## Profile wiring

In `~/.dsh/profiles/web/package.json`:

```json
"@mikhail/dsh-telegram": "file:/…/deepseek-harness/plugins/dsh-telegram",
"@mikhail/dsh-telegram-voice": "file:/…/deepseek-harness/plugins/dsh-telegram-voice",
"@mikhail/dsh-web-search-ollama": "file:/…/deepseek-harness/plugins/dsh-web-search-ollama",
"@mikhail/dsh-ollama-redis-lease": "file:/…/deepseek-harness/plugins/dsh-ollama-redis-lease"
```

Bundle order: `@mikhail/dsh-ollama-redis-lease` after `dsh-base` and `@morlay/dsh-llm-openai-compatible`, **before** `@mikhail/dsh-web-search-ollama`; `@mikhail/dsh-web-search-ollama` after `@deepseek-ai/dsh-web-app`; `@mikhail/dsh-telegram-voice` **before** `@mikhail/dsh-telegram`.

After path changes: `cd ~/.dsh/profiles/web && pnpm install`, then restart the DSH service.

## Build

Telegram ships prebuilt `lib/`. To rebuild: `cd plugins/dsh-telegram && pnpm install && pnpm build` (if `package.json` defines build).
