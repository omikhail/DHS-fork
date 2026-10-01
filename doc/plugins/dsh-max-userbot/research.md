---
title: Research — DSH MAX userbot plugin
date: 2026-10-01
type: research
doc_module: plugins
task_name: dsh-max-userbot
status: draft
tags: [dsh, max, userbot, research]
---

# Research Report: `@mikhail/dsh-max-userbot`

## Тип задачи

FEATURE

## Тикет (SSOT)

[[repo/doc/plugins/dsh-max-userbot/tz]] — третий канал общения (Web, Telegram, MAX); порт транспорта из `features/max-userbot/` в Cordis-плагин `plugins/dsh-max-userbot/`.

---

## Список релевантных файлов

### ТЗ и doc

| Полный путь | Назначение | Ключевые зависимости |
|-------------|------------|----------------------|
| `doc/plugins/dsh-max-userbot/tz.md` | Требования v1, scope, критерии приёмки | — |
| `doc/plugins/dsh-max-userbot/README.md` | Индекс артефактов задачи | wikilinks на `features/` |
| `doc/deploy/DEPLOY_DSH_WEB.md` | Выкат профиля `web`, systemd | не меняется для MAX |
| `plugins/README.md` | Индекс `@mikhail/*`, bundle order | ссылка на TZ и `features/max-userbot` |
| `plugins/AGENTS.md` | Правила личных плагинов (не в root workspace) | `file:` + `cordis.patch.yml` |

### Транспорт MAX (reference, до порта в плагин)

| Полный путь | Назначение | Ключевые зависимости |
|-------------|------------|----------------------|
| `features/README.md` | Назначение каталога `features/` | — |
| `features/max-userbot/README.md` | Состав reference-слоя | — |
| `features/max-userbot/helpers/normalizeMessage.ts` | Нормализация входящих: text/voice/other, skip own | `max-account-api` types |
| `features/max-userbot/transport/MaxClientManager.ts` | Singleton map клиентов, reconnect 2s, onMessage, reply/send | `MaxClient` из vendor |
| `features/max-userbot/vendor/max-account-api/FORK.md` | Причина форка, версия **26.32.1** | upstream maxsos1 |
| `features/max-userbot/vendor/max-account-api/src/auth.ts` | User-Agent / appVersion | — |
| `features/max-userbot/vendor/max-account-api/src/raw-transport.ts` | HELLO hex для версии клиента | — |
| `features/max-userbot/vendor/max-account-api/src/client.ts` | WebSocket клиент, `start`, `reply`, `sendMessage`, `getMe` | transport, auth |
| `features/max-userbot/vendor/max-account-api/src/index.ts` | Re-exports пакета | — |
| `features/max-userbot/vendor/max-account-api/package.json` | Сборка `dist/` (`npm run build`) | TypeScript |
| `features/max-userbot/__tests__/normalizeMessage.test.ts` | Поведение normalize/skip | Jest |
| `features/max-userbot/__tests__/MaxClientManager.test.ts` | Lifecycle manager (mock client) | Jest |
| `features/max-userbot/__tests__/vendor-max-account-api.test.ts` | Smoke импорта vendor | Jest |
| `features/max-userbot/jest.config.js` | Конфиг тестов reference | — |
| `features/max-userbot/tsconfig.json` | TS для reference | — |

В `features/max-userbot/` **нет** корневого `package.json` (только jest/tsconfig); тесты reference рассчитаны на зависимости из исходного пакета-источника.

### Ближайший аналог: Telegram front (`@mikhail/dsh-telegram`)

| Полный путь | Назначение | Ключевые зависимости |
|-------------|------------|----------------------|
| `plugins/dsh-telegram/cordis.patch.yml` | `inject: agents, credentials` | Cordis loader |
| `plugins/dsh-telegram/package.json` | `main: lib/index.js`, `dsh.bundle.patch` | peer `@deepseek-ai/cordis`, schemastery |
| `plugins/dsh-telegram/lib/index.js` | `apply`, `start`, wiring, `ctx.effect` lifecycle | agents, credentials, optional inject seams |
| `plugins/dsh-telegram/lib/config.js` | Schemastery `Config` (`tokenRef`, `allowFrom`, streaming, media) | `@deepseek-ai/schemastery` |
| `plugins/dsh-telegram/lib/harness/host.js` | `createAgentHost` — единственный модуль с `ctx.agents` | registry create/resume/dispose |
| `plugins/dsh-telegram/lib/harness/message.js` | `buildUserMessage` для `agent.followup` | локальная копия shape (без импорта dsh-llm) |
| `plugins/dsh-telegram/lib/harness/model-selection.js` | Маршрут модели на сессию | presets |
| `plugins/dsh-telegram/lib/session/bindings.js` | `BindingStore` chat ↔ session id, JSON на диске | `fs/promises` |
| `plugins/dsh-telegram/lib/session/runner.js` | `SessionRunner.prompt` — serialize per chat, resume/create agent | host, bindings |
| `plugins/dsh-telegram/lib/router.js` | Маршрутизация update → agent / commands / access | access, runner, media |
| `plugins/dsh-telegram/lib/access.js` | `AccessPolicy` — allowlist, `/claim`, owner file | crypto `timingSafeEqual` |
| `plugins/dsh-telegram/lib/reply/turn-bridge.js` | Session events → streaming Telegram reply | `RichReplyStream` |
| `plugins/dsh-telegram/lib/reply/rich-stream.js` | Edit message while streaming | Telegram API limits |
| `plugins/dsh-telegram/lib/diagnostics.js` | `StatusFile` для оператора | redactor |
| `plugins/dsh-telegram/lib/secrets.js` | `SecretRegistry` — redact token в логах | — |
| `plugins/dsh-telegram/lib/telegram/poller.js` | Long-poll loop | `AbortSignal` |
| `plugins/dsh-telegram/lib/telegram/api.js` | Bot API HTTP | token |

### Голос (паттерн STT для MAX v1.1)

| Полный путь | Назначение | Ключевые зависимости |
|-------------|------------|----------------------|
| `plugins/dsh-telegram-voice/lib/index.js` | `ctx.provide('telegramStt')` — `available`, `transcribe` | Whisper HTTP |
| `plugins/dsh-telegram-voice/cordis.patch.yml` | `baseURL`, `language`, `timeoutMs` | — |
| `plugins/dsh-telegram/lib/index.js` (≈378) | `const stt = ctx.get('telegramStt')` — опционально при voice | — |

Сервиса `maxStt` в репозитории **нет**.

### Другие `@mikhail` плагины (каркас Cordis)

| Полный путь | Назначение | Ключевые зависимости |
|-------------|------------|----------------------|
| `plugins/dsh-web-search-ollama/lib/index.js` | `export const inject`, `Config` (schemastery `z`), `apply` | `ctx.web`, `ctx.credentials` |
| `plugins/dsh-ollama-redis-lease/lib/index.js` | `ctx.provide`, waterfall `llm/stream` | credentials, llm |
| `plugins/dsh-ollama-redis-lease/package.json` | `node --test`, peer deps harness | ESM `lib/` |

### Upstream harness (только чтение, v1 не менять)

| Полный путь | Назначение |
|-------------|------------|
| `packages/core/agent-loop/` | Цикл агента (TZ: без изменений) |
| `packages/agents/` (если есть в дереве) | Реестр `ctx.agents` — потребитель telegram host |

---

## Существующие аналоги

**Канал «чат → агент → ответ в чат»** реализован в `dsh-telegram`:

1. **Загрузка:** `apply` регистрирует `ctx.effect` → `start()` при enabled.
2. **Секреты:** `ctx.credentials.resolve(config.tokenRef)`; отсутствие → idle + `status.json`, не crash всего harness (для bot token).
3. **Данные на диске:** `~/.dsh/dsh-telegram/` (`bindings.json`, `owner.json`, `status.json`, …) через `DSH_HOME`.
4. **Агент:** `createAgentHost({ agents: ctx.agents, message: buildUserMessage, … })` → `SessionRunner` вызывает `agent.followup(content)`.
5. **Ответ:** `TurnBridge` слушает session events и шлёт текст в Telegram (streaming v1 telegram; для MAX в TZ v1 — упрощённый reply после turn).

**Транспорт MAX** уже изолирован в `features/max-userbot`:

- Вход: `client.on('message')` → `normalizeMessage` → объект с `channel: 'max'`, `_reply`, опционально `voiceUrl`.
- Выход: `replyToMessage(credentialsId, incoming, text)` / `sendMessage(credentialsId, chatId, text)`.
- Идентификация «своих» сообщений: `shouldSkipMessage` сравнивает `fromId` с `ownerId` из `client.getMe()`.

**Минимальный Cordis-плагин** в форке: ESM `lib/index.js`, `export const name`, `inject`, `Config`, `apply`; `package.json` с `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` — как `dsh-web-search-ollama` и `dsh-ollama-redis-lease`.

---

## Пробелы (чего не хватает)

| Пробел | Деталь |
|--------|--------|
| Пакет `plugins/dsh-max-userbot/` | **Отсутствует** (есть только doc + `features/max-userbot`) |
| Cordis `apply` для MAX | Нет связки `MaxClientManager` ↔ `ctx.agents` |
| `BindingStore` для `chatId` MAX | Нет аналога `dsh-telegram/bindings` под MAX (TZ требует) |
| Упрощённый runner / turn → reply | Нет MAX-версии `SessionRunner` + доставки ответа без полного `TurnBridge` (или с урезанным bridge) |
| `maxStt` | Не зарегистрирован; голос из `normalizeMessage` не обработан в harness |
| Login / QR one-shot | Нет скрипта в репозитории для первичного `deviceId` + `loginToken` в credentials |
| Сборка TS → JS | Reference и vendor — **TypeScript**; личные плагины в форке в основном **готовый JS** в `lib/` (telegram). Нужна стратегия: порт в `.js`, или `tsc` + commit `lib/`, или зависимость на `vendor/.../dist` после build |
| `features/max-userbot` package.json | Нет — тесты reference не запускаются из корня feature без доработки |
| Профиль `~/.dsh` | Нет bundle `@mikhail/dsh-max-userbot` (ожидаемо до реализации) |
| Slash-команды как в telegram | Есть реализация в `commands.js` + `router.onCommand`; для MAX **не портировано** (заказчик: нужен паритет команд) |
| Паритет telegram (прочее) | Нет streaming edit, approvals, userQuestions в MAX |

---

## Дополнение: slash-команды (эталон Telegram)

Источник: `plugins/dsh-telegram/lib/commands.js`, обработка `plugins/dsh-telegram/lib/router.js` (`parseCommand` → `onCommand`).

Порядок в router **до** prompt агента: pending text → **command** → обычный текст.

| Команда | Назначение в telegram |
|---------|----------------------|
| `/start` | Приветствие + help |
| `/help` | Список команд |
| `/claim` | Владение ботом (код с консоли) |
| `/new` | Новая harness-сессия в чате |
| `/cd` | cwd сессии |
| `/model` | provider/model |
| `/effort` | reasoning effort |
| `/vision` | модель для картинок |
| `/permission` | режим разрешений агента |
| `/diag` | диагностика плагина |
| `/screenshot` | скрин хоста |
| `/sessions` | выбор прошлой сессии |
| `/status` | сессия, cwd, owner |
| `/stop` | cancel turn |
| `/whoami` | Telegram user id |

Особенности парсера: regex `^/([a-z0-9_]+)(?:@bot)?`; в группах — суффикс `@username` бота. **MAX userbot** — личный аккаунт, не Bot API: в личке команду можно трактовать как текст с префиксом `/` **без** `@mention` (аналог DM в Telegram).

Зависимости команд в telegram (для порта): `SessionRunner.reset/stop`, `ChatPreferences` (cd), `session/models` + `model-selection` (model/effort/vision), `PermissionControl`, `SessionPicker` (sessions), `Screenshotter`, `AccessPolicy` (claim), `diagnostics`/`failures` (diag).

---

## Дополнение: сессия MAX (QR) vs сессия агента (harness)

Два разных «session»:

| Смысл | Механизм | Где |
|-------|----------|-----|
| **Учётная запись MAX** (device + login) | Первый вход: QR или phone → `deviceId` + `loginToken`. Дальше: `MaxClient({ deviceId, loginToken, printQr: false })` + `start()` → `loginWithToken` | `features/max-userbot/vendor/max-account-api/src/client.ts`, `auth.ts`, `qr-bind.ts` |
| **Разговор с агентом** (session log DSH) | `BindingStore`: `chatId` → `sessionId`; `/new` сбрасывает binding | `plugins/dsh-telegram/lib/session/bindings.js`, `runner.js` |

QR в runtime плагина (**не** в systemd): при отсутствии `loginToken` `start()` может открыть QR в терминал (`printQr: true`). Для production: **one-shot** CLI (`scripts/max-userbot-login.mjs` в плагине) пишет refs в `~/.dsh/.credentials.yaml`; DSH только silent login.

`MaxClientManager` держит **один** клиент на `credentialsId` (v1 = одна пара device/token на процесс DSH) — это и есть «одно ухо» на транспортном уровне.

---

## Заметки по безопасности

| Тема | Наблюдение в аналогах / reference |
|------|-------------------------------------|
| **Секреты** | Telegram: только `tokenRef` в config; значение через `credentials.resolve`. MAX TZ: `deviceIdRef`, `loginTokenRef` — тот же паттерн. `SecretRegistry` + redactor в telegram для логов. |
| **AuthZ входящих** | Telegram: `allowFrom` (user id) + `/claim`. MAX design: **`allowPhones`** (whitelist номеров, E.164) + опционально `allowFrom`; проверка через `MaxClient.getContactInfo(fromId)` → `ContactInfo.phone` (`features/.../types.ts`). |
| **Echo loop** | `normalizeMessage` + `ownerId` — уже в reference. |
| **User content в ответ** | Telegram: HTML `escapeHtml` при render. MAX v1: plain `reply(text)` — риск интерпретации разметки на стороне клиента MAX (уточнить в design; не XSS в web). |
| **Голос** | Загрузка `voiceUrl` (внешний HTTPS) — TLS, размер файла, timeout; аналог скачивания media в telegram `media/collect.js`. |
| **Userbot** | Неофициальный API; блокировка аккаунта (TZ §13). |
| **Сырой SQL / FastAPI** | Не применимо; стек Node/Cordis. |
| **Захардкоженные секреты** | В `features/` и plugins litералов device/token нет; тесты используют `test-device` / `test-token`. |

---

## Итог

В форке уже есть **полный reference-транспорт MAX** (`features/max-userbot/`), **slash-команды и router** в `dsh-telegram`, и **QR/login контракт** в `max-account-api`. **Пакета `plugins/dsh-max-userbot` нет**. Design фиксирует: одно WS-«ухо», порт команд по образу telegram, разделение QR-setup vs harness session bindings.
