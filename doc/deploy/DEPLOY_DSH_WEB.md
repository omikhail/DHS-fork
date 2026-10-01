# DEPLOY: DeepSeek Harness Web UI (`profile web`)

Выкат форка на одну машину: клон репозитория, профиль `~/.dsh`, user systemd, Ollama через HTTP lease (без статического `OLLAMA_API_KEY`).

Детальный чеклист lease и smoke: [[repo/doc/plugins/dsh-ollama-redis-lease/runbook-local]].

## Требования

- Node.js ^22.19 или >=24 (как в корневом `package.json` harness).
- `pnpm` в `PATH`.
- Каталог `~/.dsh` с профилем `web` (создаётся при первом запуске `dsh` или вручную).

## 1. Код форка

```sh
git clone <url> deepseek-harness
cd deepseek-harness
pnpm install
```

Все `@mikhail/*` плагины лежат в `plugins/`; runnable код — в `plugins/*/lib/` (в git, без отдельной сборки для ollama/web-search/voice).

## 2. Секреты (`~/.dsh/.env`)

- `OLLAMA_LEASE_TOKEN` — обязателен для lease (заголовок `X-Ollama-Lease-Token` на Spyder).
- `OLLAMA_API_KEY` — **не задавать** при работе только через пул (строка закомментирована или удалена).
- Прочие ключи профиля (DeepSeek, Telegram и т.д.) — по вашему `cordis.patch.yml`.

## 3. Профиль `~/.dsh/profiles/web`

В `package.json`:

- `file:` dependencies на `plugins/dsh-ollama-redis-lease`, `plugins/dsh-web-search-ollama`, при необходимости telegram-плагины (пути — абсолютные к клону).
- Bundles: порядок как в [[repo/plugins/README]] (lease до web-search; `dsh-web-app` до web-search-ollama).

В `cordis.patch.yml` профиля: merge patch-блоков из репозитория + `web.config.searchProvider: ollama`.

```sh
cd ~/.dsh/profiles/web
pnpm install
cd /path/to/deepseek-harness
pnpm dsh --profile web --dump-config   # проверка дерева плагинов
```

## 4. Systemd (user)

Пример unit `~/.config/systemd/user/deepseek-harness.service`:

- `WorkingDirectory` — корень клона `deepseek-harness`.
- `ExecStart` — `node --import tsx/esm apps/cli/src/bin.ts web --no-open` (полный путь к `node` при необходимости).
- `Environment=HOME=...`, `PATH` с node/pnpm.

```sh
systemctl --user daemon-reload
systemctl --user enable --now deepseek-harness.service
```

Старт ~15–25 s. Проверка: `curl -sS -o /dev/null -w '%{http_code} %{size_download}\n' http://127.0.0.1:3080/` → `200` и размер HTML >10 KiB.

## 5. Обновление после `git pull`

```sh
cd /path/to/deepseek-harness
git pull
pnpm install
cd ~/.dsh/profiles/web && pnpm install
systemctl --user restart deepseek-harness.service
```

При смене `file:` плагинов в репозитории обязателен `pnpm install` в профиле (обновляет копии из `file:`).

## 6. Smoke после выката

См. [[repo/doc/plugins/dsh-ollama-redis-lease/runbook-local#Smoke]]: `local-lease-smoke.mjs`, chat ollama, `web_search`.

## Откат

`systemctl --user stop deepseek-harness.service`; убрать lease/web-search из профиля или вернуть статический ключ — [[repo/doc/plugins/dsh-ollama-redis-lease/runbook-local#Откат]].
