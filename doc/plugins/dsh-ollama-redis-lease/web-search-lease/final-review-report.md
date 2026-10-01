# Final Review Report: Ollama HTTP lease для `web_search`

## Статус

**PASSED** (unit/coverage + profile dump-config; live `web_search` smoke — после деплоя)

| Пакет | Версия |
|-------|--------|
| `@mikhail/dsh-ollama-redis-lease` | **0.3.0** (`ollamaHttpLease`, `lease-scope.js`) |
| `@mikhail/dsh-web-search-ollama` | **0.2.0** (`keySource`, per-`search()` lease) |

SSOT: [[repo/doc/plugins/dsh-ollama-redis-lease/web-search-lease/design]].

## Фаза A — Механика

| Проверка | Статус | Детали |
|----------|--------|--------|
| Билд | OK | ESM `lib/*.js`; `node --check` не требуется отдельно — тесты импортируют модули. |
| Тесты lease | OK | `npm test`: **15 passed**; integration SKIP без env. |
| Coverage lease | OK | **92.74%** line (`lib/**`, порог ≥80%). `index.js` вне include (wiring). |
| Тесты web-search | OK | **8 passed**. |
| Coverage web-search | OK | **88.59%** line `provider.js` (порог ≥80%). `index.js` вне include. |
| Profile compose | OK | `pnpm dsh --profile web --dump-config`: оба плагина в дереве; bundle order lease → web-search в `package.json`. |

```sh
cd plugins/dsh-ollama-redis-lease && npm test && npm run test:coverage
cd plugins/dsh-web-search-ollama && npm test && npm run test:coverage
DSH_HOME=~/.dsh pnpm dsh --profile web --dump-config | rg ollama-redis-lease|web-search-ollama
```

## Фаза B — Суждение

| Направление | Статус | Детали |
|-------------|--------|--------|
| Соответствие design | OK | ADR-WS-001…005: `ctx.provide('ollamaHttpLease')`, `runWithOllamaLease` / `streamWithOllamaLease`, web `ctx.get` + `inject credentials`, per-`search()` lease, `keySource: auto`, `available()` при lease token без static key, без upstream `dsh-web` changes. |
| Безопасность | OK | Lease token только env; логи `operation`, `id`, `label` — без `key`. Web-search не дублирует Spyder URL. |
| Симметрия LLM | OK | Один `LeaseApiClient`; credentials patch один раз в lease-плагине. |
| Документация | OK | `web-search-lease/design.md`, README обоих пакетов, bundle order. |
| Регрессия env-only | OK | `keySource: env` / отсутствие lease service — static key path в тестах. |

## Неблокирующие замечания

1. **`WEB_PROVIDER_CREDENTIAL_MISSING`** в ollama web-search — тот же code, что у deepseek search provider (согласовано с harness).
2. **Live smoke:** после `pnpm install` + restart — один `web_search` в агенте при закомментированном `OLLAMA_API_KEY`; в логах `operation=web-search`.
3. **Coverage:** ветки abort/error в `provider.js` 114–149 — опциональные тесты позже.

## Итог

Реализация **web_search + HTTP lease** соответствует design. **Деплой на профиль `web` разрешён:** `pnpm install` в `~/.dsh/profiles/web`, `systemctl --user restart deepseek-harness.service`, проверка `:3080`.
