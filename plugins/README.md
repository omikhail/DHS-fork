# Personal DSH plugins (`@mikhail/*`)

Out-of-tree Cordis bundles for the local harness fork. Not part of upstream `packages/` or root `pnpm` workspaces.

| Package | Path | Role |
|---------|------|------|
| `@mikhail/dsh-telegram` | `dsh-telegram/` | Telegram UI (fork: voice hook, session titles, `/sessions`) |
| `@mikhail/dsh-telegram-voice` | `dsh-telegram-voice/` | Whisper STT for Telegram voice messages |
| `@mikhail/dsh-web-search-ollama` | `dsh-web-search-ollama/` | Ollama Cloud `ctx.web` search provider |

Operational doc index: [[repo/doc/platform/services-catalog]].

## Profile wiring

In `~/.dsh/profiles/web/package.json`:

```json
"@mikhail/dsh-telegram": "file:/…/deepseek-harness/plugins/dsh-telegram",
"@mikhail/dsh-telegram-voice": "file:/…/deepseek-harness/plugins/dsh-telegram-voice",
"@mikhail/dsh-web-search-ollama": "file:/…/deepseek-harness/plugins/dsh-web-search-ollama"
```

Bundle order (unchanged): `@mikhail/dsh-web-search-ollama` after `@deepseek-ai/dsh-web-app`; `@mikhail/dsh-telegram-voice` **before** `@mikhail/dsh-telegram`.

After path changes: `cd ~/.dsh/profiles/web && pnpm install`, then restart the DSH service.

## Build

Telegram ships prebuilt `lib/`. To rebuild: `cd plugins/dsh-telegram && pnpm install && pnpm build` (if `package.json` defines build).
