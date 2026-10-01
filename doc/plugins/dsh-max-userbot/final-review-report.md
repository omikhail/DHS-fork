---
title: Final Review — DSH MAX userbot v1
date: 2026-10-01
type: review
doc_module: plugins
task_name: dsh-max-userbot
---

# Final Review Report: `@mikhail/dsh-max-userbot` v1

## Статус

**PASSED** (с оговорками для оператора и перед первым коммитом)

## Фаза A — Механика

| Проверка | Статус | Детали |
|----------|--------|--------|
| Билд | OK | `node --check lib/index.js`; динамический `import` пакета, `apply` — function. Vendor `dist/` присутствует в рабочей копии. |
| Линтеры | OK | Python-гейты (ruff/mypy/bandit) не применимы. Отдельный ESLint для плагина в репозитории не прогонялся — риск низкий (JS без TS, стиль близок к `dsh-telegram`). |
| Тесты + coverage | OK | `npm test`: **50/50** pass. `npm run test:coverage`: **81.77%** aggregate по включённым файлам `lib/**` (исключены `lib/vendor/**`, `lib/index.js`, `lib/transport/**` — см. `package.json`). Порог design.md (≥80% `lib/**` без vendor) выполнен для отчёта coverage. `lib/transport/MaxClientManager.js` покрыт отдельным suite `test/MaxClientManager.test.js`, но в метрику не входит. Низкое покрытие `router.js` (~64%) и `runner.js` (~66%) — не блокер при текущем aggregate. |

## Фаза B — Суждение (субагенты)

| Направление | Статус | Детали |
|-------------|--------|--------|
| Безопасность | OK | Credentials через `ctx.credentials.resolve`; `loginToken` в `SecretRegistry` + redact в router. Жёстко захардкоженных секретов в коде плагина нет. Authz: `PhoneWhitelistPolicy` (`allowPhones` / `allowFrom`), при пустой конфигурации — warn и **молчаливый deny** всех входящих (без утечки «вы не в списке»). Owner echo (`is_owner_message`) отфильтрован. Голос v1 не скачивается (только ответ «не обрабатываются») — пункт design про `voiceUrl` cap отложен до STT. Bandit N/A (JS). |
| Соответствие дизайну | OK | Cordis `apply`, inject `agents` + `credentials`, schemastery `Config`, один клиент на credentials id, `BindingStore` + урезанный `SessionRunner`, команды MVP, `TurnReplyBridge` без streaming, chunking, QR только в `scripts/max-userbot-login.mjs`, appVersion vendor **26.32.1**. Расхождения v1 осознанные: нет streaming/approvals как TG v2; голос без STT. |
| Документация | OK | TZ, research, design, plan-mode-prompt, `runbook-local.md`, `plugins/README.md`, пакетный README. **Долг:** `design.md` frontmatter `status: proposed` — обновить на `implemented` после коммита; в индексе `doc/plugins/dsh-max-userbot/README.md` добавлена ссылка на этот отчёт. |

## Не входит в автоматический гейт (оператор)

| Шаг | Статус |
|-----|--------|
| Сборка vendor после клона | Не проверялось в CI harness |
| `max-userbot-login.mjs` → `~/.dsh/.credentials.yaml` | Ручной |
| Profile `file:` + patch + **непустой** `allowPhones` | Ручной |
| Restart DSH + smoke `/help`, текст, `/new` | **Не выполнялся** ревьюером — обязателен перед продом |

## Рекомендации (не блокируют PASSED)

1. **Перед `git add`:** не коммитить `lib/vendor/max-account-api/node_modules/` и корневой `node_modules` плагина; в `files` npm только `lib` — убедиться, что `.gitignore` отсекает vendor `node_modules`.
2. **Тесты:** опционально — лёгкий integration/smoke на `lib/index.js` (mock `ctx`, abort lifecycle) для wiring без исключения из coverage.
3. **Документы:** `design.md` → `status: implemented`; после успешного smoke — отметить чеклист в design §11 / runbook.
4. **Покрытие:** при росте `router.js` / `runner.js` добавить тесты на ветки command handlers и session errors (сейчас <70% по файлу).

## Детали ошибок (если FAILED)

— (нет критических провалов Фазы A/B)

## Итог

Код v1 **готов к коммиту** в репозиторий и к операторской выкладке по [[repo/doc/plugins/dsh-max-userbot/runbook-local]] после ручного smoke на реальном MAX. Повторный Phase 3 нужен только при существенных изменениях (streaming, STT, смена auth-модели) или если manual smoke провалится.
