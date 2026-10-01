---
title: Runbook — DSH MAX userbot (local)
date: 2026-10-01
type: runbook
doc_module: plugins
task_name: dsh-max-userbot
---

# Runbook: `@mikhail/dsh-max-userbot` (local / dev)

SSOT: [[repo/doc/plugins/dsh-max-userbot/tz]], [[repo/doc/plugins/dsh-max-userbot/design]].

## Prerequisites

- Node ≥ 22
- Built vendor: `plugins/dsh-max-userbot/lib/vendor/max-account-api/dist/`
- DSH profile `web` (or headless) with `agents` + `credentials`

## 1. Vendor build

```sh
cd plugins/dsh-max-userbot/lib/vendor/max-account-api
npm install && npm run build
```

## 2. QR login (one-shot)

```sh
cd plugins/dsh-max-userbot
node scripts/max-userbot-login.mjs
```

Record in `~/.dsh/.credentials.yaml`:

- `MAX_USERBOT_DEVICE_ID`
- `MAX_USERBOT_LOGIN_TOKEN`

## 3. Profile wiring

`~/.dsh/profiles/web/package.json` — `file:` dependency on `plugins/dsh-max-userbot`.

Bundle patch (example config):

```yaml
- id: max-userbot
  name: '@mikhail/dsh-max-userbot'
  config:
    enabled: true
    deviceIdRef: MAX_USERBOT_DEVICE_ID
    loginTokenRef: MAX_USERBOT_LOGIN_TOKEN
    appVersion: "26.32.1"
    allowPhones: ["+79001234567"]
    allowFrom: []
    reply:
      maxChars: 4000
```

`pnpm install` in the profile directory, then restart DSH.

## 4. Smoke

1. `~/.dsh/dsh-max-userbot/status.json` → `connected`
2. MAX: `/help`
3. Text prompt → agent reply in chat
4. `/new` → new harness session (check `bindings.json`)
5. Web UI and Telegram still work (regression)

## 5. State on disk

| Path | Role |
|------|------|
| `~/.dsh/dsh-max-userbot/bindings.json` | `chatId` → harness `sessionId` |
| `~/.dsh/dsh-max-userbot/phone-cache.json` | `fromId` → normalized phone |
| `~/.dsh/dsh-max-userbot/status.json` | Plugin connection state |

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `idle` + missing credentials | Run login script; verify credential refs |
| `unsupported-version` | Rebuild vendor; `appVersion: "26.32.1"` |
| No replies, silent inbound | `allowPhones` / `allowFrom`; `/whoami` for id and phone |
| Echo loop | Owner messages are ignored by design |

**Prod:** see [[repo/doc/deploy/DEPLOY_DSH_WEB]] — do not change prod without explicit approval.
