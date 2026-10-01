# Research Report: Ollama key lease для DSH (`@mikhail/dsh-ollama-redis-lease`)

## Тип задачи

FEATURE (переопределение требований: **HTTP lease API**, не прямой Redis)

## Тикет (актуальный)

На каждый streaming LLM-запрос DSH к провайдеру **`ollama`**: плагин **POST** на application-сервер (`/api/ollama/keys/lease`), получает JSON с полем **`key`**, подставляет его в `ctx.credentials.resolve(OLLAMA_API_KEY)`, затем morlay-адаптер ходит в **Ollama Cloud**. Пул, lock и «не выдать дважды» — **ответственность сервера**; DSH **не** подключается к Redis и **не** реализует карантин.

Пример эксплуатации (оператор):

- URL: `https://spyder-10.lighthouselabs.online/api/ollama/keys/lease`
- Заголовок: `X-Ollama-Lease-Token` (секрет только env / credentials, не в git)
- Тело ответа (фактический формат от оператора): `id`, `key`, `label`, `is_active`, `locked_until`, `lock_seconds` (например 90)

**Устарело:** прежняя версия `doc/plugins/dsh-ollama-redis-lease/tz.md` и реализация с **ioredis / SPOP** — не соответствуют эксплуатации; код в `plugins/dsh-ollama-redis-lease/` требует **переписывания** под HTTP (см. пробелы).

---

## Список релевантных файлов

| Полный путь | Назначение | Ключевые зависимости |
|-------------|------------|----------------------|
| `plugins/dsh-ollama-redis-lease/lib/index.js` | Текущий `apply` — **Redis + ioredis** (подлежит замене) | ioredis, schemastery |
| `plugins/dsh-ollama-redis-lease/lib/redis-pool.js` | SPOP/HGET/lock — **удалить/заменить** | ioredis |
| `plugins/dsh-ollama-redis-lease/lib/llm-stream-bridge.js` | `llm/stream` prepend, acquire/release/quarantine — **упростить** (только HTTP acquire, без release/quarantine) | lease-context |
| `plugins/dsh-ollama-redis-lease/lib/credentials-delegate.js` | `patchCredentialsResolve` + ALS — **переиспользовать** | dsh-credentials (peer) |
| `plugins/dsh-ollama-redis-lease/lib/lease-context.js` | `AsyncLocalStorage.enterWith` — **переиспользовать** | node:async_hooks |
| `plugins/dsh-ollama-redis-lease/test/*.test.js` | Тесты Redis-модели — **переписать** под HTTP mock | node:test |
| `plugins/dsh-web-search-ollama/lib/index.js` | Образец function-plugin, `Schema`, `inject`, `apply` | schemastery |
| `plugins/dsh-web-search-ollama/lib/provider.js` | Образец `fetch` + Bearer к внешнему API | fetch |
| `packages/credentials/credentials/src/index.ts` | `resolve(ref)` per operation | Cordis Service |
| `packages/llm/llm/src/index.ts` | Waterfall `llm/stream` | Cordis |
| `docs/subsystems/llm-streaming.md` | Порядок stream / middleware | — |
| `~/.dsh/profiles/web/cordis.patch.yml` (вне git) | `providers.ollama.apiKeyEnv: OLLAMA_API_KEY`, morlay | — |
| `doc/plugins/dsh-ollama-redis-lease/tz.md` | Старое ТЗ (Redis) — **не SSOT** до обновления tz | — |
| `doc/plugins/dsh-ollama-redis-lease/design.md` | Предыдущий design (Redis) — заменён новой версией | — |
| `doc/plugins/dsh-ollama-redis-lease/final-review-report.md` | Review Redis-реализации — **не актуален** для HTTP | — |

В репозитории harness **нет** описания OpenAPI для `/api/ollama/keys/lease` (только устаревшее упоминание в старом tz). Контракт зафиксирован из эксплуатации и сообщений оператора.

---

## Существующие аналоги

### 1. Интеграция LLM (morlay + harness)

- `@morlay/dsh-llm-openai-compatible`: в начале `stream()` вызывается `ctx.credentials.resolve(OLLAMA_API_KEY)` (или env fallback).
- Один вызов resolve на один streaming-запрос; параллельные stream → параллельные resolve (нужна изоляция ключа на запрос — ALS).

### 2. Паттерн плагина (уже в `dsh-ollama-redis-lease`)

- `inject: ['credentials', 'llm']`.
- `llm/stream` с `prepend: true` только для `options.provider === 'ollama'` (configurable).
- `patchCredentialsResolve` на `inner` без замены всего `ctx.credentials`.
- `enterActiveLease` до итерации `next()` — совместимо с ADR-004 прежнего design.

### 3. HTTP из личных плагинов

- `dsh-web-search-ollama`: `fetch` к Ollama Cloud с Bearer; конфиг base URL; ключ из env при `apply` (статический), не per-request — для lease **не** образец жизненного цикла, только стиль `fetch`.

### 4. Application lease API (вне harness)

- Единственная задокументированная в эксплуатации операция для DSH: **POST lease** → JSON с `key`.
- Отдельного вызова «карантин» или «release» со стороны DSH оператор **не требует**; lock на стороне сервера (`lock_seconds`, `locked_until`).

---

## Пробелы (чего не хватает)

1. **Код плагина** реализует **Redis**, не HTTP — несоответствие продукту.
2. **`tz.md`** описывает Redis SPOP и карантин в DSH — расходится с целевой логикой.
3. **Нет** в git спецификации ошибок lease API (4xx/5xx, rate limit, пустой пул) — парсинг и retry на design.
4. **Не подтверждено в репо** наличие endpoint **release/complete** после stream; по умолчанию v1 — **только acquire** на каждый stream, без обратного HTTP.
5. **`plugins/README.md`** и `cordis.patch.yml` пакета ссылаются на Redis host — обновить при реализации.
6. **Интеграционный тест** против реального spyder — только с env (token + URL), self-skip в CI.
7. **Имя пакета** `dsh-ollama-redis-lease` вводит в заблуждение; переименование опционально (путь/doc_module можно оставить для непрерывности).

---

## Заметки по безопасности

- **`X-Ollama-Lease-Token`** и поле **`key`** в ответе — секреты: только `*Env` / credentials file, не литералы в YAML/git.
- Логи: допустимы `id`, `label`, `lock_seconds`; **не** логировать `key` и lease token.
- TLS: production URL HTTPS; при self-signed — явная опция в config (не `-k` по умолчанию в коде).
- Плагин не открывает входящих портов; исходящий HTTPS к доверенному хосту.
- Валидация: config через schemastery; JSON-ответ — проверка наличия непустого `key` на границе wire.

---

## Итог

Целевой поток: **DSH → POST lease (spyder) → key в ALS → resolve → Ollama**. Точка hook в harness **та же**, что исследована ранее (`llm/stream` + `credentials.resolve`), меняется только **адаптер acquire** (HTTP вместо Redis). Текущий код в `plugins/dsh-ollama-redis-lease/` — **прототип неверной архитектуры**; переиспользуемы bridge/delegate/ALS, модуль pool/redis — заменить на HTTP lease client.
