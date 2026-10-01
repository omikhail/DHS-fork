Роль: Node ESM Cordis-плагины в форке deepseek-harness — добавить STT для MAX (Whisper HTTP) по образу `@mikhail/dsh-telegram-voice`, без prod-деплоя из Plan Mode.
Режим: **Plan** — только план реализации и чеклист. Код, деплой на prod, publish — **НЕ делать**, пока пользователь явно не попросит после утверждения плана.

## Задача одной фразой
Голосовые сообщения в MAX скачиваются по `voiceUrl`, распознаются через Whisper (`maxStt`), текст уходит агенту; при отсутствии STT — сообщение пользователю, без падения DSH.

## SSOT (прочитать полностью перед планом)
- doc/plugins/max-voice-stt/research.md
- doc/plugins/max-voice-stt/design.md
- doc/plugins/dsh-max-userbot/tz.md (§9 Голос)
- doc/plugins/dsh-max-userbot/runbook-local.md

## Принятые решения (не переоткрывать без нового ADR)
1. **ADR-001:** Новый пакет `plugins/dsh-max-voice/`, `ctx.provide('maxStt', { available, transcribe })` — контракт как `telegramStt`, не переиспользовать имя `telegramStt`.
2. **ADR-002:** Скачать аудио + Whisper POST `/asr`; **не** использовать `MaxClient.transcribeMedia` / push op 293 в этой итерации.
3. **ADR-003:** `downloadVoice` в `dsh-max-userbot`: только `https:` URL, `maxBytes` + `downloadTimeoutMs` из schemastery `config.voice`.
4. **ADR-004:** Prompt part: `{ type: 'text', text: '🎤 ' + transcript }` (+ optional caption prefix из `item.text`).
5. **ADR-005:** `maxStt` опционален; `available() === false` или нет provide → RU stub («Расшифровка голоса недоступна» / как в telegram collect).
6. **ADR-006:** `dsh-max-voice` Config: `baseURL` default `http://localhost:9000`, `language` default `ru`, `timeoutMs` default `30000`; userbot `voice.maxBytes` default 20_000_000, `voice.downloadTimeoutMs` default 60000, `voice.mimeType` default `audio/ogg`.

## Out of scope (явно)
- Нативная транскрипция MAX (op 202 / NOTIF_TRANSCRIPTION).
- Общий npm-пакет WhisperClient для TG+MAX.
- Streaming / «распознаём…» в UI MAX.
- Изменения `dsh-telegram` / `dsh-telegram-voice` кроме документации cross-link при желании.
- Коммит секретов; правки prod systemd без OK пользователя.

## Текущее состояние кода (проверить в репозитории)
- `plugins/dsh-max-userbot/lib/router.js` — `messageType === 'voice'` → `say('Голосовые сообщения пока не обрабатываются.')`.
- `plugins/dsh-max-userbot/lib/normalizeMessage.js` — выставляет `voiceUrl`, `voiceDurationMs`.
- `plugins/dsh-max-userbot/lib/index.js` — не вызывает `ctx.get('maxStt')`.
- `plugins/dsh-max-userbot/lib/config.js` — нет секции `voice`.
- `plugins/dsh-telegram-voice/lib/index.js` + `whisper-client.js` — образец STT.
- `plugins/dsh-telegram/lib/media/collect.js` — `transcribeVoice` (сообщения RU, flow download→transcribe).
- Vendor: `plugins/dsh-max-userbot/lib/vendor/max-account-api` — `downloadFile` в `src/media.ts` (можно импортировать из собранного `dist` или дублировать fetch в userbot — выбрать в плане с меньшим coupling).
- Тесты: `plugins/dsh-max-userbot/test/router-commands.test.js` (voice stub), `normalizeMessage.test.js`.
- Пакета `plugins/dsh-max-voice/` **нет**.

## Prod / staging (только справка для smoke в плане)
- Локальный DSH: `systemctl --user restart deepseek-harness.service`, Web `http://127.0.0.1:3080`.
- Whisper: `http://localhost:9000` (как в `~/.dsh/profiles/web/cordis.patch.yml` для telegram-voice).
- MAX userbot: `allowPhones`, credentials MAX уже настроены у оператора.
- **Не трогать prod** без отдельного OK в этом чате.

## Что должен содержать план (структура ответа Plan-агента)
1. **Пошаговый порядок:** сначала `dsh-max-voice`, затем userbot `lib/voice/*`, затем router/index, затем тесты, затем docs.
2. **Дельта по файлам** — полные пути из design §11 checklist.
3. **Контракты:** `maxStt` методы; поля `config.voice`; формат prompt parts.
4. **Тесты:** unit download/pipeline/router; `npm test` в обоих пакетах; coverage ≥80% на новый код.
5. **Идемпотентность:** новый bundle patch insert; не ломать существующие telegram bundles.
6. **Регрессии:** текстовые сообщения MAX, команды `/help`, access deny, `TurnReplyBridge`; Telegram voice unchanged.
7. **Smoke:** отправить голос в MAX → ответ агента; остановить Whisper → stub; `npm test` green.
8. **Риски:** audio codec, pnpm copy без dist, длинные voice files.

## Ограничения репозитория
- ESM, schemastery Config, `ctx.provide` / `ctx.get`, без hardcoded tunables.
- doc/: wikilinks `[[repo/doc/...]]`; при правках doc — link audit если есть скрипт.
- Секреты не коммитить; коммит только по запросу пользователя.
- Не менять `packages/` harness core.

## Deliverable Plan-режима
Один markdown-план + список файлов к изменению. В конце — **вопросы к заказчику** только если без них нельзя кодить (макс. 3).

**Не пиши код в этом ответе. Не деплой. Не коммит.**

---

## После OK пользователя на план (отдельный промпт, не сейчас)

«Выполни утверждённый план из предыдущего сообщения. Реализуй код и тесты по doc/plugins/max-voice-stt/design.md. Прогони `npm test` в `plugins/dsh-max-voice` и `plugins/dsh-max-userbot`. Напиши «код готов». Операторский wire профиля `web` — только если пользователь попросит.»
