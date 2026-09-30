# AGENTS.md — `plugins/`

- Only **personal** `@mikhail/*` plugins and forks live here. npm/GitHub plugins stay in `~/.dsh/profiles/web/node_modules/`.
- Do **not** add these directories to root `pnpm-workspace.yaml` or `packages/*`.
- Config: `cordis.patch.yml` per package + profile `package.json` `file:` dependencies.
- Bundle order: `dsh-telegram-voice` before `dsh-telegram`; `dsh-web-search-ollama` after `dsh-web-app`.
