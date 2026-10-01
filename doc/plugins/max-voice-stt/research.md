---
title: Research — MAX voice (STT) for dsh-max-userbot
date: 2026-10-01
type: research
doc_module: plugins
task_name: max-voice-stt
status: draft
---

# Research Report: MAX voice messages → text (STT)

## Тип задачи

FEATURE

## Тикет

Входящие голосовые в MAX сейчас отвечают «Голосовые сообщения пока не обрабатываются.» Нужно распознавание речи и передача текста агенту, по аналогии с Telegram + `@mikhail/dsh-telegram-voice` (Whisper на `localhost:9000` уже в профиле `web`).

## Список релевантных файлов

| Полный путь | Назначение | Ключевые зависимости |
|-------------|------------|----------------------|
| `plugins/dsh-max-userbot/lib/router.js` | Обработка входящих; ветка `messageType === 'voice'` — ранний ответ-заглушка | `SessionRunner`, `access` |
| `plugins/dsh-max-userbot/lib/normalizeMessage.js` | Выставляет `messageType: 'voice'`, `voiceUrl`, `voiceDurationMs` из AUDIO attach | типы `max-account-api` |
| `plugins/dsh-max-userbot/lib/config.js` | Schemastery `Config` — **нет** полей для STT / лимитов скачивания голоса | `@deepseek-ai/schemastery` |
| `plugins/dsh-max-userbot/lib/index.js` | `apply`, lifecycle; **не** получает `ctx.get('maxStt')` | `MaxClientManager`, `MaxUpdateRouter` |
| `plugins/dsh-max-userbot/lib/harness/message.js` | `buildUserMessage` — массив `{ type: 'text', text }` | — |
| `plugins/dsh-max-userbot/test/normalizeMessage.test.js` | Фикстура voice + `voiceUrl` | `node:test` |
| `plugins/dsh-max-userbot/test/router-commands.test.js` | Тест: voice → текст «Голосовые…» | mock router |
| `plugins/dsh-max-userbot/lib/vendor/max-account-api/src/media.ts` | `downloadFile(downloadUrl)` — GET signed URL, `Uint8Array` | `fetch` |
| `plugins/dsh-max-userbot/lib/vendor/max-account-api/src/client.ts` | `transcribeMedia(chatId, messageId)` op 202 — async, результат push op 293, **не** используется в плагине | transport |
| `plugins/dsh-telegram-voice/lib/index.js` | `ctx.provide('telegramStt', { available, transcribe })` | `WhisperClient` |
| `plugins/dsh-telegram-voice/lib/whisper-client.js` | HTTP POST `/asr`, multipart `audio_file`, `output_format=text` | `fetch`, FormData |
| `plugins/dsh-telegram-voice/lib/config.js` | `baseURL`, `language`, `timeoutMs` | schemastery |
| `plugins/dsh-telegram-voice/cordis.patch.yml` | Вставка плагина в bundle | — |
| `plugins/dsh-telegram-voice/package.json` | Пакет `@mikhail/dsh-telegram-voice`, без тестов в репо | — |
| `plugins/dsh-telegram/lib/index.js` | `const stt = ctx.get('telegramStt')` → передаётся в media collector | `agents`, `credentials` |
| `plugins/dsh-telegram/lib/media/collect.js` | `transcribeVoice`: download bytes → `stt.transcribe` → prompt `🎤 ${text}` | Telegram file API |
| `plugins/dsh-telegram/lib/media/intake.js` | Классификация `voice` / `audio` по `message.voice` | — |
| `features/max-userbot/helpers/normalizeMessage.ts` | Эталон нормализации voice (порт в плагин) | — |
| `doc/plugins/dsh-max-userbot/tz.md` | §9 Голос: `maxStt`, скачать `voiceUrl`, Whisper | — |
| `doc/plugins/dsh-max-userbot/design.md` | §9 Безопасность: size cap, timeout, HTTPS для `voiceUrl` | — |
| `doc/plugins/dsh-max-userbot/final-review-report.md` | v1: голос без скачивания — осознанный defer | — |
| `plugins/README.md` | Порядок bundle: `dsh-telegram-voice` **before** `dsh-telegram` | — |

Операторский профиль (вне git, факт развёртывания): `~/.dsh/profiles/web/package.json` уже содержит `@mikhail/dsh-telegram-voice` с `baseURL: http://localhost:9000`, `language: ru`; `@mikhail/dsh-max-userbot` подключён отдельно.

## Существующие аналоги

### Telegram: опциональный STT-сервис

1. Плагин **`@mikhail/dsh-telegram-voice`** регистрирует Cordis-сервис **`telegramStt`** с контрактом:
   - `available(): Promise<boolean>` — probe `GET ${baseURL}/docs`
   - `transcribe(audio: Uint8Array, opts?: { mimeType?, language?, signal? }): Promise<string>`
2. **`dsh-telegram`** при сборке media вызывает `MediaCollector.transcribeVoice`: скачивает файл по `file_id` через Bot API, затем Whisper. Если `stt` нет или `available() === false` — пользователю stub («не могу прочитать» / «расшифровка недоступна»).
3. Успешный текст попадает в агент как один text-block с префиксом `🎤`.

### MAX v1: нормализация есть, STT нет

1. **`normalizeMessage`** помечает входящее AUDIO с `url` как `voice` и кладёт **`voiceUrl`** (тест: `https://a.oneme.ru/audio?cid=1`).
2. **`MaxUpdateRouter.handle`**: при `voice` сразу `say('Голосовые сообщения пока не обрабатываются.')` — **без** `fetch`, **без** `ctx.get`.
3. Текстовые сообщения идут в `runPrompt` → `SessionRunner.prompt` с `[{ type: 'text', text }]`.

### Vendor: скачивание аудио

- **`downloadFile(url)`** в vendored `max-account-api` — прямой GET по URL из attach (не op 88 file flow для типичного `a.oneme.ru/audio?...`).
- **`MaxClient.transcribeMedia`** — серверная транскрипция MAX (push), в harness **нигде не подключена**; поток отличается от синхронного Whisper.

### ТЗ / design (ожидаемое поведение)

- `doc/plugins/dsh-max-userbot/tz.md` §9: `maxStt` с тем же контрактом, что `telegramStt`; скачать `voiceUrl` → transcribe; при недоступном STT — сообщение пользователю, плагин не падает.
- `design.md` §9: лимиты на скачивание `voiceUrl` (HTTPS, timeout, size cap).

## Пробелы (чего не хватает)

| Пробел | Где сейчас |
|--------|------------|
| Cordis-сервис **`maxStt`** | Нет пакета `plugins/dsh-max-voice` и нет `ctx.provide('maxStt')` |
| Подключение STT в **`dsh-max-userbot`** | `index.js` / `router.js` не вызывают `ctx.get('maxStt')` |
| Скачивание **`voiceUrl`** | Нет модуля `lib/media/` или аналога `collect.js` |
| Конфиг лимитов голоса (`maxBytes`, `timeoutMs`, `allowedHosts`) | Нет в `plugins/dsh-max-userbot/lib/config.js` |
| Обработка voice → **`runPrompt`** с транскриптом | Router не вызывает runner для voice |
| Тесты STT-пути | Только тест заглушки в `router-commands.test.js` |
| Документация runbook (smoke voice) | `runbook-local.md` не описывает голос |
| Переиспользование **`dsh-telegram-voice`** | Только `telegramStt`; отдельное имя `maxStt` в ТЗ — факт: два provide или расширение одного плагина **не реализовано** |

Альтернатива **не исследована в коде плагина**: нативная `transcribeMedia` + подписка на push 293 — потребовала бы доработки transport/events, сейчас не используется.

## Заметки по безопасности

- **Authz:** голос обрабатывается только после `PhoneWhitelistPolicy.check` (как текст) — менять порядок в router не требуется.
- **SSRF / fetch:** `voiceUrl` приходит с wire MAX; ТЗ/design требуют **HTTPS-only**, лимит размера и timeout перед `transcribe` (аналог `MediaCollector` + лимиты telegram на `maxBytes`).
- **Секреты:** Whisper URL в `cordis.patch.yml` профиля (как telegram-voice), не в коде плагина.
- **Утечки в лог:** `WhisperClient` логирует превью транскрипта на `debug`; в telegram-voice — тот же паттерн; redact в MAX router уже есть для ошибок prompt.
- **XSS:** ответы — plain text в MAX chat, не HTML.
- **Сырой SQL / FastAPI:** не применимо (Node plugins).
- Захардкоженных API-ключей в зоне изменений **не найдено**.

## Итог

Ближайший образец — связка **`dsh-telegram-voice`** (`telegramStt` + Whisper) и **`dsh-telegram/lib/media/collect.js`** (download → transcribe → text part). В MAX уже есть **`voiceUrl`** на нормализованном сообщении и **`downloadFile`** в vendor; не хватает STT-провайдера (`maxStt`), скачивания с лимитами и замены заглушки в **`router.js`** на путь в `SessionRunner`. Основные точки изменений: новый или расширенный voice-плагин, `plugins/dsh-max-userbot/lib/index.js`, `router.js`, новый модуль загрузки голоса, `config.js`, тесты и профиль `web` (bundle + patch).
