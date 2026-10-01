---
title: ТЗ — DSH-плагин MAX userbot (канал общения)
date: 2026-10-01
type: tz
doc_module: plugins
task_name: dsh-max-userbot
status: active
tags: [dsh, max, userbot, messenger, plugin, cordis, telegram-parity, profsalon]
---

# ТЗ: `@mikhail/dsh-max-userbot`

Cordis-плагин для **DeepSeek Harness**: третий **канал общения** с агентом (наряду с **Web UI** и **Telegram**). Плагин держит **userbot-сессию MAX** (WebSocket, неофициальный `max-account-api`), принимает входящие сообщения, будит harness-агента и отправляет ответы в тот же чат.

Код планируется в `plugins/dsh-max-userbot/` форка; подключение — `file:` в `~/.dsh/profiles/web` (и при необходимости `headless`). Исследование и reference-исходники n8n: проект Spyder, `doc/n8n/ProfSalon/max-userbot-dsh/` (копия `reference-code/`, README с архитектурой).

---

## 1. Контекст: каналы DSH

| Канал | Реализация в форке | Роль |
|-------|-------------------|------|
| **Web** | `@deepseek-ai/dsh-web-app` + профиль `web` | Браузер, полный UI, сессии в harness |
| **Telegram** | `@mikhail/dsh-telegram` (+ опционально `@mikhail/dsh-telegram-voice`) | Бот в Telegram, `inject: agents, credentials` |
| **MAX** | **`@mikhail/dsh-max-userbot`** (этот ТЗ) | Личный аккаунт MAX (userbot), диалоги 1:1 и чаты |

Один и тот же агент (пресет, инструменты, LLM, память сессии) должен обслуживаться **независимо от фронта**. MAX не заменяет Web/Telegram; добавляется параллельный вход/выход.

---

## 2. Проблема

- Пользователи ProfSalon / «Джонни» уже общаются в MAX; ответы сейчас идут через **n8n** (рабочая нода на spyder-9), а не через единый DSH-стек.
- Дублирование логики: n8n workflow vs harness agent-loop, разные сессии и инструменты.
- Нет единого места для skills, web_search, lease-ключей Ollama и session log в MAX.

## 3. Цель

- **Вход:** входящее сообщение MAX (текст; голос — через STT) → нормализованный payload → **budить агента** через `ctx.agents` (паттерн как у `dsh-telegram`).
- **Выход:** ответ агента → `reply` в тот же тред / `sendMessage` по `chatId`.
- **Сессии:** привязка `chatId` (и при необходимости `fromId`) к harness session id с сохранением на диске (аналог bindings в telegram).
- **Креды:** `deviceId` + `loginToken` только через `ctx.credentials`, не в `cordis.patch.yml` литералами.
- **Транспорт:** переиспользовать проверенный слой из n8n reference (`MaxClientManager`, `normalizeMessage`, форк `max-account-api` **appVersion 26.32.1**).

## 4. Не в scope (v1)

- Официальный MAX Bot API (если появится) — только userbot.
- Публикация плагина в npm / upstream DeepSeek Harness.
- Полный паритет с `dsh-telegram`: streaming edit сообщений, `/sessions`, media OCR/vision, approvals и `ask_user_question` в MAX UI (отдельные задачи v2).
- Общая сессия MAX с n8n на spyder-9 (**новая** QR/phone-сессия для DSH).
- Изменения `packages/core/agent-loop`, `packages/agents` upstream.
- Групповые админ-команды, рассылки, спам-защита beyond простого allowlist.

## 5. Эталоны и переиспользование

| Источник | Что брать |
|----------|-----------|
| `plugins/dsh-telegram` | `inject: agents, credentials`; `createAgentHost` / session runner; binding store; fail loud при старте |
| Spyder `max-userbot-dsh/reference-code` | `helpers/normalizeMessage.ts`, `transport/MaxClientManager.ts`, `vendor/max-account-api/` (форк) |
| `plugins/dsh-telegram-voice` | Паттерн `ctx.provide('…Stt')` + Whisper HTTP (для MAX — **`maxStt`** или общий STT-сервис v2) |

n8n-файлы `MaxUserbotTrigger.node.ts` / `MaxUserbot.node.ts` — **не** копировать; заменить на `apply(ctx, config)` DSH.

## 6. Архитектура плагина

```
plugins/dsh-max-userbot/
├── package.json              # @mikhail/dsh-max-userbot, dsh.bundle.patch
├── cordis.patch.yml
├── lib/
│   ├── index.js              # apply: lifecycle, router → agent
│   ├── config.js             # schemastery Config
│   ├── harness/              # host, message (по образу telegram, без копипасты 1:1 если вынести общее позже)
│   ├── session/              # bindings, runner (упрощённый v1)
│   ├── transport/            # MaxClientManager (из reference, ESM)
│   ├── normalizeMessage.js   # из reference
│   └── vendor/max-account-api/   # форк, сборка dist при необходимости
└── test/                     # unit: normalize, manager (mock client)
```

### Cordis

```yaml
- insert:
    - id: max-userbot
      name: '@mikhail/dsh-max-userbot'
      inject:
        - agents
        - credentials
```

Опционально `inject: credentials` только; интерактивные seams (`userQuestions`, `approvals`) — через `ctx.inject()` внутри `apply`, как в telegram, если профиль их не объявляет.

### Поток сообщения (v1)

1. `getOrCreateClient(credentials)` → `MaxClient.start()` (silent login по `loginToken`).
2. `onMessage` → `normalizeMessage(msg, ownerId)` → `null` если своё или status.
3. Если `messageType === 'voice'` → скачать `voiceUrl` → `maxStt.transcribe` (если сервис есть) → текст в user message.
4. Resolve/create session по `chatId` → `SessionRunner` / host → `agent.followup(...)`.
5. Ответ: `replyToMessage(incoming, text)`; длинный текст — разбиение по лимитам MAX (константа в плагине, v1 простое chunking).

## 7. Credentials

| Ref (пример) | Содержимое | Обязательность |
|--------------|------------|----------------|
| `MAX_USERBOT_DEVICE_ID` | UUID устройства после QR/phone login | да |
| `MAX_USERBOT_LOGIN_TOKEN` | токен повторного входа без SMS | да |

Config плагина: `deviceIdRef`, `loginTokenRef`, `appVersion` (default **`26.32.1`**), не сами секреты.

Первичная выдача кредов: отдельный **one-shot** скрипт или CLI-режим с `printQr: true` **вне** production unit (не в systemd loop). Результат — запись в `~/.dsh/.credentials.yaml`.

## 8. Транспорт `max-account-api`

- Зависимость: `file:vendor/max-account-api` (форк из reference).
- Обязательный патч версии клиента **26.32.1** (`FORK.md` в vendor); без него — `client.unsupported-version`.
- Reconnect: debounce **2 s** на `error`/`close` (как `MaxClientManager`).
- Один клиент на набор кредов (v1 — одна учётка MAX на инстанс DSH).

## 9. Голос (STT)

**v1 (минимум):**

- Плагин `@mikhail/dsh-max-voice` **или** расширение существующего voice-плагина: `ctx.provide('maxStt')` с контрактом как `telegramStt` (`available`, `transcribe`).
- Config: `baseURL` Whisper (пример с инфраструктуры клиента: `http://whisper-asr:9000` или localhost tunnel).
- Если STT недоступен — ответ пользователю «голосовые не обрабатываются» (не падать весь плагин).

## 10. Конфигурация (пример)

```yaml
- id: max-userbot
  name: '@mikhail/dsh-max-userbot'
  config:
    enabled: true
    deviceIdRef: MAX_USERBOT_DEVICE_ID
    loginTokenRef: MAX_USERBOT_LOGIN_TOKEN
    appVersion: "26.32.1"
    allowFrom: []          # пусто = все входящие (v1); иначе список fromId
    presetId: ""           # optional default agent preset
    cwd: ""                # default harness cwd
    reply:
      maxChars: 4000       # chunk outbound text
```

## 11. Профиль `web`

`~/.dsh/profiles/web/package.json`:

- `"@mikhail/dsh-max-userbot": "file:/…/deepseek-harness/plugins/dsh-max-userbot"`
- Bundle: после `@deepseek-ai/dsh-base`, рядом с `@mikhail/dsh-telegram` (порядок между фронтами не критичен, если нет shared `provide`).

При использовании lease Ollama / web_search — те же bundles, что в [[repo/doc/deploy/DEPLOY_DSH_WEB]]; MAX-плагин их не меняет.

## 12. Ошибки и наблюдаемость

- Старт без кредов / пустой token → fail loud, `status` файл (по аналогии telegram diagnostics).
- Логи: `chatId`, `messageId`, `messageType`, reconnect; **не** логировать `loginToken`, URL с секретами, полные raw payload в production.
- Метрика успеха ops: входящее → ответ без `WEB_PROVIDER_*` / без падения процесса.

## 13. Риски и ограничения

- Userbot — реверс протокола; возможна блокировка аккаунта. Rate limit ответов, без массовых рассылок.
- SMS-login MAX требует **RU-IP**; для dev — QR или туннель (операционно, не в git).
- Долгие ответы LLM: typing indicator — **v2** (если API позволяет).

## 14. Тестирование

| Уровень | Что |
|---------|-----|
| Unit | `normalizeMessage` (skip own, text/voice), `MaxClientManager` с mock `MaxClient` |
| Integration | self-skip без `MAX_USERBOT_TEST_DEVICE_ID` + token в env |
| Manual | QR-сессия → написать в MAX → ответ агента; голос → текст → ответ |

Coverage: ≥ **80%** строк `lib/**` в каталоге плагина (исключая сгенерированный `vendor/**/dist` при отдельной политике).

## 15. Критерии приёмки

- [ ] DSH с профилем `web` стартует с включённым `max-userbot` без ошибок загрузки дерева.
- [ ] Входящий **текст** в MAX → агент отвечает в тот же чат (reply).
- [ ] Повторный запуск DSH **без** повторного QR (silent login по `loginToken`).
- [ ] Сообщения от **ownerId** не вызывают ответ (нет echo loop).
- [ ] Параллельно работают **Web** и **Telegram** (регрессия не ломается).
- [ ] Секреты только в credentials/env; в репозитории нет `deviceId`/`loginToken` литералов.
- [ ] (Опционально v1.1) Голос → STT → ответ текстом.

## 16. План поставки

1. Перенести `vendor`, `transport`, `normalizeMessage` в `plugins/dsh-max-userbot` (ESM, schemastery config).
2. Каркас `apply` + минимальный `SessionRunner` (один chat → одна session).
3. Скрипт первичного login (QR) → вывод refs для credentials file.
4. Подключить профиль, systemd restart, manual smoke.
5. Документы: `research.md`, `design.md` в `doc/plugins/dsh-max-userbot/`; runbook после стабилизации.
6. (Следующая итерация) `dsh-max-voice` / parity с telegram media и approvals.

## 17. Связанные документы

- [[repo/plugins/README]] — индекс `@mikhail/*`
- [[repo/doc/deploy/DEPLOY_DSH_WEB]] — выкат Web + профиль
- [[repo/doc/plugins/dsh-max-userbot/README]] — индекс doc модуля
- Вне репозитория harness: Spyder `doc/n8n/ProfSalon/max-userbot-dsh/README.md`, `reference-code/`
