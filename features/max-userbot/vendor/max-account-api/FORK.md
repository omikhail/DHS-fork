# Vendored fork: max-account-api

Upstream: [maxsos1/max-account-api](https://github.com/maxsos1/max-account-api) @ v0.1.1 (MIT).

## Why vendored

npm `max-account-api@0.1.1` advertises an outdated MAX client version (`26.5.5` / HELLO template for `26.15.1`). MAX servers reject it (`client.unsupported-version`). Spyder pins a maintained copy with version strings updated for **26.32.1** (verified on spyder-9, T1–T3).

## Changes vs upstream

| File | Change |
|------|--------|
| `src/auth.ts` | `DEFAULT_USER_AGENT.appVersion` → `26.32.1` |
| `src/raw-transport.ts` | `HELLO_TEMPLATE_HEX` app version + build bytes for 26.32.1 |

No postinstall patches. Rebuild after edits: `npm run build` in this directory.
