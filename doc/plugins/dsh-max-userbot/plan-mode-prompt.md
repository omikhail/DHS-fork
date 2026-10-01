Роль: Cordis-плагин `@mikhail/dsh-max-userbot` на Node ESM в форке deepseek-harness — MAX userbot как третий фронт DSH (одно WS-«ухо», slash-команды как telegram, harness sessions).
Режим: **Plan** — только план реализации и чеклист. Код, деплой на prod, publish, **git commit** — **НЕ делать**, пока пользователь явно не попросит после утверждения плана.

## Задача одной фразой
Подключить MAX (userbot) к DSH: слушать чаты, обрабатывать `/команды` как в `dsh-telegram`, вести harness-сессии по `chatId`, отвечать через lease того же агента.

## SSOT (прочитать полностью перед планом)
- doc/plugins/dsh-max-userbot/research.md
- doc/plugins/dsh-max-userbot/design.md
- doc/plugins/dsh-max-userbot/tz.md
- features/max-userbot/README.md
- plugins/dsh-telegram/lib/commands.js, router.js, session/runner.js, harness/host.js (эталон)

## Принятые решения (не переоткрывать без нового ADR)
1. **ADR-001:** один `MaxClient` / один `credentialsId` на процесс DSH.
2. **ADR-002:** slash-команды — паритет с telegram; MVP: start, help, new, cd, model, status, stop, whoami; парсер без обязательного `@bot`.
3. **ADR-003:** QR только в `scripts/max-userbot-login.mjs`; плагин `printQr: false`, без token — idle + инструкция.
4. **ADR-004:** bindings `~/.dsh/dsh-max-userbot/bindings.json`; auth через **`allowPhones`** (whitelist номеров, нормализация цифр) + опционально `allowFrom`; `getContactInfo` + `phone-cache.json`; пустые списки = deny all.
5. **ADR-005:** ответ v1 через session events → `replyToMessage`, chunk `reply.maxChars`, без streaming edit.
6. **ADR-006:** плагин в ESM `.js`; vendor `max-account-api` через `dist/` после `npm run build`.

## Out of scope (явно)
- Изменения `packages/core/agent-loop`, upstream agents.
- Telegram-style HTML, streaming message edit в MAX.
- `claim` как у бота (заменён allowFrom); approvals / ask_user_question в MAX UI (v2).
- v1.1+: effort, vision, permission, sessions picker; v1.2: diag, screenshot.
- Публикация npm, автодеплой prod.

## Текущее состояние кода (проверить в репозитории)
- `features/max-userbot/` — transport, normalize, vendor src, jest tests.
- `plugins/dsh-max-userbot/` — **отсутствует**.
- `plugins/dsh-telegram/` — полный front (commands, router, runner, turn-bridge).
- `plugins/dsh-telegram-voice/` — `telegramStt` (позже `maxStt`).

## Prod / staging (только справка)
- Профиль `~/.dsh/profiles/web`, systemd `deepseek-harness.service` — см. doc/deploy/DEPLOY_DSH_WEB.md.
- **Не трогать prod** без отдельного OK.

## Что должен содержать план (структура ответа Plan-агента)
1. Пошаговый порядок (vendor build → lib port → router/commands → runner → bridge → login script → tests).
2. Дельта по файлам в `plugins/dsh-max-userbot/**`.
3. Контракты: normalized message, command table, binding key, credential refs.
4. Тесты: unit router/commands/transport; перенос из features.
5. Регрессии: web + telegram bundles не ломаются.
6. Smoke: login script → credentials → dump-config → `/help` → prompt → reply.
7. Риски S/M/L.

## Ограничения репозитория
- doc/: wikilinks `[[repo/doc/...]]`.
- Секреты не коммитить; **не делать git commit** без явной команды пользователя.
- Личные плагины: `file:` в `~/.dsh`, не root pnpm workspace.

## Deliverable Plan-режима
Один markdown-план + список файлов. В конце — вопросы к заказчику (макс. 3), только если блокируют код.

**Не пиши код в этом ответе. Не деплой. Не коммит.**

---

## После OK пользователя на план (отдельный промпт, не сейчас)

«Выполни утверждённый план. Реализуй `plugins/dsh-max-userbot` по design.md. Прогони тесты плагина. Напиши «код готов». Коммит и деплой — только по явной просьбе.»
