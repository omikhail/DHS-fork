# `@mikhail/dsh-max-userbot`

MAX userbot channel for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): one WebSocket session, harness agent sessions per `chatId`, slash commands aligned with `@mikhail/dsh-telegram` (MVP set).

## Build vendor (required once per clone)

```sh
cd lib/vendor/max-account-api
npm install
npm run build
```

## Install in profile

In `~/.dsh/profiles/web/package.json`:

```json
"@mikhail/dsh-max-userbot": "file:/path/to/deepseek-harness/plugins/dsh-max-userbot"
```

Add the bundle patch from `cordis.patch.yml` and set `allowPhones` in plugin config.

## First login (QR)

```sh
node scripts/max-userbot-login.mjs
```

Copy `MAX_USERBOT_DEVICE_ID` and `MAX_USERBOT_LOGIN_TOKEN` into `~/.dsh/.credentials.yaml`.

## Tests

```sh
npm test
npm run test:coverage
```

## Operational doc

See [[repo/doc/plugins/dsh-max-userbot/runbook-local]] in the repo `doc/` tree.
