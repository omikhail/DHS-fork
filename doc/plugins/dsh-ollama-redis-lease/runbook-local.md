# Runbook: локальный HTTP lease (DSH `web`)

Операционный чеклист для машины с `~/.dsh` и systemd user unit `deepseek-harness.service`.

Полный выкат (git, systemd, профиль): [[repo/doc/deploy/DEPLOY_DSH_WEB]].

## Preflight

| Проверка | Команда | Ожидание |
|----------|---------|----------|
| DSH home | `ls ~/.dsh/.env` | файл есть |
| Lease token | `grep -q '^OLLAMA_LEASE_TOKEN=' ~/.dsh/.env && echo ok` | ok (значение не логировать) |
| Без статического ключа | `grep -E '^OLLAMA_API_KEY=' ~/.dsh/.env` | пусто (строка закомментирована или отсутствует) |
| Web UI | `curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/` | 200, тело >10 KiB |
| Процесс | `systemctl --user status deepseek-harness.service` | active (running) |
| Lease в dump | `cd deepseek-harness && pnpm dsh --profile web --dump-config \| grep ollama-redis-lease` | блок `@mikhail/dsh-ollama-redis-lease` |
| Web-search в dump | `pnpm dsh --profile web --dump-config \| grep web-search-ollama` | `@mikhail/dsh-web-search-ollama` |
| Search provider | `pnpm dsh --profile web --dump-config \| grep -A2 'id: web'` | `searchProvider: ollama` |
| Lease API | два POST lease, сравнить `jq -r .id` | разные id |
| Unit-тесты lease | `cd plugins/dsh-ollama-redis-lease && npm test` | 15 pass |
| Unit-тесты web-search | `cd plugins/dsh-web-search-ollama && npm test` | 10 pass |

Пример lease (без вывода `key`):

```sh
set -a && source ~/.dsh/.env && set +a
curl -sS -X POST 'https://spyder-10.lighthouselabs.online/api/ollama/keys/lease' \
  -H "X-Ollama-Lease-Token: $OLLAMA_LEASE_TOKEN" -H 'Accept: application/json' | jq -r '.id'
```

## Wiring (профиль `web`)

Пути: `~/.dsh/profiles/web/package.json`, `cordis.patch.yml`.

**Dependencies (`file:` на каталоги в клоне форка):**

- `plugins/dsh-ollama-redis-lease`
- `plugins/dsh-web-search-ollama`

**Bundles (фрагмент порядка):**

1. `@deepseek-ai/dsh-base`, `@morlay/dsh-llm-openai-compatible`
2. `@mikhail/dsh-ollama-redis-lease` — **до** web-search
3. `@deepseek-ai/dsh-web-app`
4. `@mikhail/dsh-web-search-ollama` — после `dsh-web-app`

**Patch:** блоки из репозитория:

- [[repo/plugins/dsh-ollama-redis-lease/cordis.patch.yml]]
- [[repo/plugins/dsh-web-search-ollama/cordis.patch.yml]]

Плюс в профиле для плагина `web`: `searchProvider: ollama`.

**Env (`~/.dsh/.env`):** задан `OLLAMA_LEASE_TOKEN`; `OLLAMA_API_KEY` не задан (пул ключей только через lease).

```sh
cd ~/.dsh/profiles/web && pnpm add \
  "@mikhail/dsh-ollama-redis-lease@file:/absolute/path/to/deepseek-harness/plugins/dsh-ollama-redis-lease" \
  "@mikhail/dsh-web-search-ollama@file:/absolute/path/to/deepseek-harness/plugins/dsh-web-search-ollama"
pnpm install
cd /path/to/deepseek-harness && pnpm dsh --profile web --dump-config
```

## Restart

```sh
systemctl --user restart deepseek-harness.service
# старт ~15–25s; при редком user-questions duplicate — systemd перезапустит сам
curl -sS -o /dev/null -w '%{http_code} %{size_download}\n' http://127.0.0.1:3080/
```

Unit: `~/.config/systemd/user/deepseek-harness.service` (cwd = harness repo, `web --no-open`). См. [[repo/doc/deploy/DEPLOY_DSH_WEB]].

## Smoke

1. **Bridge + Spyder** (без UI):

```sh
cd deepseek-harness
node plugins/dsh-ollama-redis-lease/scripts/local-lease-smoke.mjs
```

Ожидание: три строки `ollama-http-lease: acquired id=...` с **разными** id.

2. **LLM (ollama):** Web `http://127.0.0.1:3080`, провайдер **ollama**, короткий prompt; в journal те же `acquired id=` с `operation=llm-stream` (если логирование включено).

```sh
journalctl --user -u deepseek-harness.service -f | grep ollama-http-lease
```

3. **web_search:** в сессии запрос с поиском (tool `web_search`). Ошибки `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` при пустом lease/token — см. preflight. Успех: результаты поиска; в логах lease при необходимости `operation=web-search`.

```sh
journalctl --user -u deepseek-harness.service --since -5m | grep -E 'web-search|ollama-http-lease|WEB_PROVIDER'
```

## Откат

Убрать bundles и `file:` dependencies для lease и web-search-ollama, блоки `ollama-redis-lease` и `web-search-ollama` из patch, вернуть `searchProvider` или статический `OLLAMA_API_KEY` по политике, `pnpm install`, `systemctl --user restart deepseek-harness.service`.

## Ссылки

- [[repo/doc/plugins/dsh-ollama-redis-lease/README]]
- [[repo/doc/plugins/dsh-ollama-redis-lease/tz]]
- [[repo/doc/plugins/dsh-ollama-redis-lease/design]]
- [[repo/doc/plugins/dsh-ollama-redis-lease/web-search-lease/design]]
