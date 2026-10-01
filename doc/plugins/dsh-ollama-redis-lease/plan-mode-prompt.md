Роль: Node.js / Cordis function-plugin в `plugins/dsh-ollama-redis-lease/` (out-of-tree `@mikhail/*`). **Рефакторинг:** убрать Redis-реализацию, сделать **HTTP lease** на spyder. Интеграция с `ctx.llm` + `ctx.credentials` без правок upstream `packages/`.

Режим: **Plan** — только план работ и чеклист удаления/замены. Код, деплой на prod, publish — **НЕ делать**, пока пользователь явно не попросит после утверждения плана.

## Задача одной фразой

На каждый streaming LLM-запрос к провайдеру `ollama`: плагин **POST** на lease API (`/api/ollama/keys/lease` + `X-Ollama-Lease-Token`), получает JSON с **`key`**, подставляет через `credentials.resolve(OLLAMA_API_KEY)`, morlay идёт в Ollama Cloud. **Без Redis, без release/quarantine в DSH.**

## SSOT (прочитать полностью перед планом)

- doc/plugins/dsh-ollama-redis-lease/research.md — актуальные факты (HTTP)
- doc/plugins/dsh-ollama-redis-lease/design.md — ADR и checklist §11
- doc/plugins/dsh-ollama-redis-lease/tz.md — **устарел (Redis)**; план должен включить **обновление tz** под HTTP или явную ссылку на design как источник до правки tz
- plugins/AGENTS.md
- plugins/dsh-web-search-ollama/lib/index.js — образец function-plugin
- plugins/dsh-web-search-ollama/lib/provider.js — образец `fetch` (не lifecycle ключа)

## Skills / references (DeepSeek Harness)

- `AGENTS.md`, `plugins/AGENTS.md`, `docs/cordis-primer.md`, `docs/subsystems/llm-streaming.md`
- Implement / push: `.agents/skills/dsh-pre-push-checks` → `npm test` + `npm run test:coverage` в каталоге плагина
- README: `.agents/skills/dsh-prose-standard`
- Не опираться на `.ai/.ai/skills` вместо harness rules

## Принятые решения (не переоткрывать без нового ADR)

1. **ADR-001 (HTTP):** acquire = `POST` lease API; `lease.baseURL`, `lease.path`, `lease.tokenEnv` → header `X-Ollama-Lease-Token` (default).
2. **ADR-002:** **нет** release HTTP, **нет** карантина, **нет** Redis в DSH v1; lock — на сервере (`lock_seconds` в ответе только для логов).
3. **ADR-003:** сохранить `llm/stream` `prepend: true` + `patchCredentialsResolve` + ALS `enterWith` до `for await (next())`.
4. **ADR-004:** HTTP через native `fetch`, timeout + retry на 5xx/сеть (не на 401 token).
5. **ADR-005:** config schemastery: убрать `redis`, `pool`, `quarantine`; добавить `lease.*`; `allowStaticFallback: false`; bundle после `dsh-base` и morlay LLM.
6. **ADR-006:** успешный ответ: 2xx JSON, непустой `key`; логировать `id`, `label`, не `key`/token.

## Что выкинуть («старое говно») — обязательно в плане

| Удалить / заменить | Почему |
|--------------------|--------|
| `lib/redis-pool.js` | SPOP/HGET/lock — не продукт |
| зависимость `ioredis` в `package.json` | DSH не ходит в Redis |
| `test/mock-redis.js`, Redis-тесты в `test/redis-pool.test.js` | заменить mock `fetch` |
| `quarantine` в Config, bridge `finally` release/quarantine | вне scope HTTP v1 |
| `cordis.patch.yml` блоки `redis`, `pool`, `quarantine` | заменить на `lease.baseURL`, `lease.tokenEnv` |
| README / `plugins/README.md` формулировки «Redis pool» | HTTP lease spyder |
| Опора на `tz.md` §4 Redis, `final-review-report.md` (Redis review) | устарели |

## Что оставить / доработать

| Файл | Действие |
|------|----------|
| `lib/lease-context.js` | оставить (минимально) |
| `lib/credentials-delegate.js` | оставить; `source` можно `ollama-http-lease` |
| `lib/llm-stream-bridge.js` | **упростить:** `pool.acquire()` → `leaseClient.acquire()`; убрать quarantine/release в `finally` (только лог duration / errors) |
| `lib/errors.js` | заменить коды Redis на `LEASE_*` |
| `lib/index.js` | новый Config, wiring `LeaseApiClient`, disposer без `redis.quit()` |
| **новый** `lib/lease-api-client.js` | POST + parse JSON + retries |

## Out of scope

- Прямой Redis / ioredis / SPOP / карантин HASH в DSH
- HTTP **release** endpoint (до появления в API)
- Quota Ollama usage API
- Fork morlay, правки `packages/credentials`, `agent-loop`
- Общий lease pool для `dsh-web-search-ollama`
- `pnpm-workspace.yaml`
- Переименование npm-пакета (имя `dsh-ollama-redis-lease` оставить, описание — HTTP)

## Текущее состояние кода

- `plugins/dsh-ollama-redis-lease/` **существует** — **Redis-версия** (несоответствует design)
- `doc/.../research.md`, `design.md` — **HTTP** (актуально)
- `doc/.../tz.md`, `plan-mode-prompt.md` (старая версия), `final-review-report.md` — частично устарели
- Профиль: `providers.ollama.apiKeyEnv: OLLAMA_API_KEY`; lease token — отдельная env (например `OLLAMA_LEASE_TOKEN`)

## Prod / smoke (справка)

- Lease: `https://spyder-10.lighthouselabs.online/api/ollama/keys/lease` (host в config)
- DSH: `deepseek-harness.service`, Web `:3080`
- Smoke: 3 параллельных ollama-запроса → в логах **разные** `id` lease; morlay доходит до Ollama; **нет** секретов в git
- **Не трогать prod** без OK в чате

## Что должен содержать план (структура ответа Plan-агента)

1. **Порядок:** `lease-api-client` + тесты → упростить bridge → index/config → удалить redis → обновить patch/README/plugins README → обновить `tz.md` → прогон тестов.
2. **Дельта файлов** — явный список delete/create/edit.
3. **Контракт wire:** POST, headers, поля JSON (`id`, `key`, `label`, …), ошибки 401/5xx.
4. **Тесты:** mock `fetch`; integration self-skip без `OLLAMA_LEASE_TEST_URL` + token env; coverage ≥80% `lib/`.
5. **Disposer:** unpatch credentials, снять `llm/stream`, без redis.quit.
6. **Регрессии:** non-ollama без POST; `dsh --dump-config`; параллельные streams → параллельные POST lease.
7. **Smoke** — без проверки Redis; без quarantine acceptance.
8. **Риски:** долгий stream vs `lock_seconds` (L, server); тело POST empty vs `{}` (M, default empty).

## Ограничения репозитория

- Секреты не коммитить (`OLLAMA_LEASE_TOKEN`, `key` из ответов)
- Плагин только `file:` в профиле
- doc: wikilinks `[[repo/doc/...]]` при правках

## Deliverable Plan-режима

Один markdown-план + таблица файлов (delete/edit/add). Макс. 3 вопроса к заказчику только если блокируют код.

**Не пиши код. Не деплой. Не коммит.**

---

## После OK пользователя на план (отдельный промпт — implement)

Выполни утверждённый план. **Удали Redis-код**, реализуй HTTP lease по `design.md`. Обнови `tz.md`, `README.md`, `cordis.patch.yml`, `plugins/README.md`. Соблюдай `AGENTS.md` и `plugins/AGENTS.md`. Прогони `npm test` и `npm run test:coverage` в `plugins/dsh-ollama-redis-lease/`. Перед push — `.agents/skills/dsh-pre-push-checks`. README — `.agents/skills/dsh-prose-standard`. Напиши «код готов». Деплой — только по явной просьбе.
