# Services catalog (DeepSeek Harness)

Индекс **operational** `doc_module` для этого checkout. Код и архитектура upstream: [[repo/docs/architecture]], группы пакетов: [[repo/packages/README]].

## `doc_module` → путь

| doc_module | Путь | Что покрывает |
|------------|------|----------------|
| `platform` | `doc/platform/` | Профили, `~/.dsh`, сборка, CI-окружение, общая инфра вокруг harness |
| `bundle` | `doc/bundle/` | Профили `web` / `headless`, bundles (`dsh-base`, `dsh-web-app`), `cordis.patch.yml` |
| `core` | `doc/core/` | Session log, agent loop, tools, system prompt (`packages/core/`) |
| `capability` | `doc/capability/` | Capability seams: llm, shell, fs, web, session, … (см. [[repo/docs/capability-seams]]) |
| `deploy` | `doc/deploy/` | Выкат, systemd, хосты, скрипты деплоя (`doc/deploy/DEPLOY_*.md`) |
| `plugins` | `doc/plugins/` | Out-of-tree Cordis-плагины (Telegram, voice, search providers) |
| `observability` | `doc/observability/` | Алерты, логи, метрики, on-call runbooks |
| `sdk` | `doc/sdk/` | JSON-RPC SDK, ACP, внешние интеграции (`packages/sdk/`, `packages/acp/`) |

Добавляй строку при появлении нового runtime-модуля; задачи — только в `doc/<doc_module>/<task_name>/`.

## Профили и точки входа

| Профиль | Назначение |
|---------|------------|
| `web` | Web UI (по умолчанию `http://127.0.0.1:3080`) |
| `headless` | One-shot CLI без сервера |

Диагностика дерева плагинов: `dsh --profile web --dump-config` ([[repo/docs/architecture#profiles-and-bundles]]).

## Связанные каталоги кода

| Каталог | Роль |
|---------|------|
| `packages/` | Workspace `@deepseek-ai/dsh-*` |
| `examples/` | Runnable `cordis.yml` поверх example bundles |
| `python/` | Python SDK |
| `vendor/` | Vendored Cordis |
| `.agents/` | Agent Notes и skills репозитория harness |
