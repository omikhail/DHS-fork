---
title: Final Review — MAX voice STT
date: 2026-10-01
type: review
doc_module: plugins
task_name: max-voice-stt
---

# Final Review Report: MAX voice → Whisper STT

## Статус

**PASSED** (с оговорками: коммит + операторский wire + ручной smoke голоса)

## Фаза A — Механика

| Проверка | Статус | Детали |
|----------|--------|--------|
| Билд | OK | `node --check` на `dsh-max-voice/lib/index.js`, `dsh-max-userbot/lib/voice/pipeline.js`. |
| Линтеры | OK | ruff/mypy/bandit N/A (JS). Pre-commit не прогонялся на этом diff — риск низкий. |
| Тесты + coverage | OK | `plugins/dsh-max-voice`: **4/4**. `plugins/dsh-max-userbot`: **64/64**. Coverage userbot aggregate **82.78%**; `lib/voice/download.js` **83.33%**, `lib/voice/pipeline.js` **93.75%** — порог design (≥80% на новый код в voice) выполнен. |

## Фаза B — Суждение (субагенты)

| Направление | Статус | Детали |
|-------------|--------|--------|
| Безопасность | OK | HTTPS-only в `assertAllowedVoiceUrl`; streaming cap `maxBytes`; download timeout; authz без изменений (после whitelist). Whisper URL в patch профиля, не в коде. Замечание: при отсутствии `voiceUrl` пользователю уходит фрагмент на английском (`voice URL is missing`) — косметика, не блокер. |
| Соответствие дизайну | OK | ADR-001…006: отдельный `dsh-max-voice` + `maxStt`; download + pipeline; `handleVoice` → `runPrompt`; config `voice.*`; RU stubs как telegram; op 202 не используется. |
| Документация | OK | `design.md`, `plan-mode-prompt.md`, `research.md`; `runbook-local.md` § voice; `plugins/README.md` bundle order. `design.md` frontmatter `status: proposed` — обновить на `implemented` после коммита. |

## Не входит в автоматический гейт

| Шаг | Статус |
|-----|--------|
| `~/.dsh/profiles/web` — `dsh-max-voice` dep + bundle + patch | Не в git; оператор |
| Restart DSH + голосовое в MAX с Whisper :9000 | Не проверялось ревьюером |
| `git commit` изменений voice | **Не сделан** (часть файлов untracked / modified) |

## Рекомендации (не блокируют PASSED)

1. Закоммитить: `plugins/dsh-max-voice/`, `lib/voice/*`, тесты, doc `max-voice-stt/`, runbook, README.
2. Оператор: wire профиля по runbook §3–4, `pnpm install`, restart; smoke голос.
3. Выровнять RU в `pipeline.js` для случая missing `voiceUrl`.
4. Опционально: `test:coverage` в `dsh-max-voice/package.json` для CI-паритета.

## Детали ошибок (если FAILED)

— (нет)

## Итог

Реализация **соответствует** [[repo/doc/plugins/max-voice-stt/design]]. Код готов к **коммиту** и операторской выкладке; после wire + smoke голоса в MAX можно считать фичу закрытой в prod-local.
