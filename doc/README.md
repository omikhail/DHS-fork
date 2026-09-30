# Operational documentation (`doc/`)

Каталог **operational** заметок, runbook'ов и артефактов агентного цикла (research, design, review). Это не upstream-документация Harness.

Официальная документация проекта для контрибьюторов: каталог `docs/` — [[repo/docs/architecture]], [[repo/docs/development]], cookbooks, gates. Файлы из `docs/` сюда не переносить и не дублировать runbook'и.

## Выбор `doc_module`

Идентификатор runtime-модуля в kebab-case. Полный список для этого репозитория: [[repo/doc/platform/services-catalog]].

Перед новой задачей выбери `doc_module` из каталога или добавь строку в services-catalog отдельным изменением.

## Пути артефактов

Все пути — от **корня git-репозитория**:

- `doc/<doc_module>/<task_name>/research.md`
- `doc/<doc_module>/<task_name>/design.md`
- `doc/<doc_module>/<task_name>/plan-mode-prompt.md`
- `doc/<doc_module>/<task_name>/final-review-report.md`

**Запрещено:** `doc/<task_name>/` в корне `doc/` (без `doc_module`).

Runbook модуля: `doc/<doc_module>/runbook.md` или `doc/<doc_module>/README.md`.

## Конвенции и промпты

Универсальные правила: `.ai/prompts/doc_conventions.md` (субмодуль ai-skills). Ссылки между файлами в `doc/`: [[repo/doc/OBSIDIAN]].
