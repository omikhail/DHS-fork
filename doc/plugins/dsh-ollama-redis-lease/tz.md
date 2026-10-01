---
title: ТЗ — DSH-плагин Ollama HTTP key lease
date: 2026-10-01
type: tz
doc_module: plugins
task_name: dsh-ollama-redis-lease
status: active
tags: [dsh, ollama, http, lease, spyder, credentials, llm, cordis, plugin]
---

# ТЗ: `@mikhail/dsh-ollama-redis-lease`

Cordis-плагин для DeepSeek Harness: на каждый streaming LLM-запрос к провайдеру **`ollama`** выполняет **POST** на lease API application-сервера (Spyder), получает JSON с полем **`key`**, подставляет его через `ctx.credentials.resolve(OLLAMA_API_KEY)`. Пул, lock и политика ключей — **на сервере**; DSH **не** подключается к Redis и **не** вызывает release/quarantine в v1.

Имя пакета историческое (`redis-lease`); реализация — **только HTTP**. Детали: [[repo/doc/plugins/dsh-ollama-redis-lease/design]], [[repo/doc/plugins/dsh-ollama-redis-lease/research]].

Код: `plugins/dsh-ollama-redis-lease/`, профиль `web` / `headless` через bundle + `cordis.patch.yml`.

---

## 1. Проблема

- Morlay-адаптер Ollama читает один статический `OLLAMA_API_KEY`.
- Параллельные агенты исчерпывают quota на одном ключе.
- Ручная ротация в `~/.dsh/.env` не масштабируется.

## 2. Цель

- Каждый **ollama** `llm/stream` → один HTTP acquire → уникальный ключ с сервера.
- Секреты lease token и API keys — только env / credentials file, не в git.
- DeepSeek, Telegram и другие LLM-провайдеры не затрагиваются.

## 3. `web_search` (расширение)

- Сервис `ctx.provide('ollamaHttpLease')` из этого плагина; `@mikhail/dsh-web-search-ollama` вызывает `runWithLease('web-search', …)` на каждый `search()`.
- Ключ — через тот же `credentials.resolve(OLLAMA_API_KEY)` в ALS, что и для LLM.
- Bundle: lease-плагин **раньше** web-search. SSOT: `doc/plugins/dsh-ollama-redis-lease/web-search-lease/design.md`.

## 4. Не в scope (v1)

- Прямой Redis / ioredis / SPOP / карантин HASH в DSH.
- HTTP **release** после stream/search (до появления в API).
- Quota-aware выбор по Ollama usage API.
- Изменения `packages/credentials`, `agent-loop`, fork morlay, `packages/web`.
- Один lease на весь multi-query `web_search` tool call (v2).

## 5. Контракт HTTP lease (Spyder)

| Элемент | Значение |
|---------|----------|
| Метод | `POST` |
| Path (default) | `/api/ollama/keys/lease` |
| Base URL | Config `lease.baseURL` (пример: `https://spyder-10.lighthouselabs.online`) |
| Заголовок | `X-Ollama-Lease-Token` (config `lease.tokenHeader`) из `lease.tokenEnv` (пример `OLLAMA_LEASE_TOKEN`) |
| Тело запроса v1 | Пустое; `Accept: application/json` |
| Успех | HTTP 2xx, JSON с непустой строкой **`key`** |
| Поля ответа (ops) | `id`, `label`, `lock_seconds`, `locked_until`, `is_active` — для логов; DSH использует `key` для Bearer |

Повторные попытки: только сеть и 5xx, не 401/403 token.

## 6. Интеграция Cordis

- `inject: ['credentials', 'llm']`.
- `llm/stream` `prepend: true` для `provider === ollama` (configurable).
- `patchCredentialsResolve` + ALS `enterWith` до итерации `next()`.
- После stream: **нет** cleanup HTTP/Redis в DSH v1.

## 7. Конфигурация (пример)

```yaml
- id: ollama-redis-lease
  name: '@mikhail/dsh-ollama-redis-lease'
  config:
    lease:
      baseURL: https://spyder-10.lighthouselabs.online
      path: /api/ollama/keys/lease
      tokenEnv: OLLAMA_LEASE_TOKEN
    provider:
      credentialRef: OLLAMA_API_KEY
      llmProviderId: ollama
    allowStaticFallback: false
```

## 8. Ошибки и наблюдаемость

- Отсутствие lease token → fail fast (`LEASE_TOKEN_MISSING`).
- 401/403 lease → ошибка stream, без retry.
- Логи: `id`, `label`, `durationMs`, опционально `lock_seconds`; **не** логировать `key` и token.

## 9. Тестирование

- Unit: mock `fetch` (client, bridge, delegate).
- Integration: self-skip без `OLLAMA_LEASE_TEST_URL` + `OLLAMA_LEASE_TOKEN`.
- Coverage ≥ 80% строк `lib/**` в каталоге плагина.

## 10. Критерии приёмки

- [ ] Три параллельных ollama stream → разные `id` в логах.
- [ ] `web_search` без статического `OLLAMA_API_KEY` при `OLLAMA_LEASE_TOKEN` и правильном bundle order.
- [ ] В репозитории нет литералов lease token / API keys / Redis password.
- [ ] Нет зависимости `ioredis` и кода `redis-pool`.
- [ ] `dsh --dump-config` валиден с обновлённым patch.

---

Конвенции: [[repo/doc/README]].
