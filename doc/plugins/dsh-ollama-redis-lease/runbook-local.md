# Runbook: локальный HTTP lease (DSH `web`)

Операционный чеклист для машины с `~/.dsh` и systemd user unit `deepseek-harness.service`.

## Preflight

| Проверка | Команда | Ожидание |
|----------|---------|----------|
| DSH home | `ls ~/.dsh/.env` | файл есть |
| Lease token | `grep -q '^OLLAMA_LEASE_TOKEN=' ~/.dsh/.env && echo ok` | ok (значение не логировать) |
| Web UI | `curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/` | 200 |
| Процесс | `systemctl --user status deepseek-harness.service` | active (running) |
| Плагин в dump | `cd deepseek-harness && pnpm dsh --profile web --dump-config \| grep ollama-redis-lease` | блок `@mikhail/dsh-ollama-redis-lease` |
| Lease API | два POST lease, сравнить `jq -r .id` | разные id |
| Unit-тесты | `cd plugins/dsh-ollama-redis-lease && npm test` | 13 pass |

Пример lease (без вывода `key`):

```sh
set -a && source ~/.dsh/.env && set +a
curl -sS -X POST 'https://spyder-10.lighthouselabs.online/api/ollama/keys/lease' \
  -H "X-Ollama-Lease-Token: $OLLAMA_LEASE_TOKEN" -H 'Accept: application/json' | jq -r '.id'
```

## Wiring (профиль `web`)

Пути: `~/.dsh/profiles/web/package.json`, `cordis.patch.yml`.

- Dependency `file:` на `plugins/dsh-ollama-redis-lease`
- Bundle `@mikhail/dsh-ollama-redis-lease` **после** `@morlay/dsh-llm-openai-compatible`
- Блок `ollama-redis-lease` в patch (см. [plugins/dsh-ollama-redis-lease/cordis.patch.yml](../../../plugins/dsh-ollama-redis-lease/cordis.patch.yml))

```sh
cd ~/.dsh/profiles/web && pnpm install
cd deepseek-harness && pnpm dsh --profile web --dump-config
```

## Restart

```sh
systemctl --user restart deepseek-harness.service
# старт ~15–25s; при редком user-questions duplicate — systemd перезапустит сам
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/
```

Unit: `~/.config/systemd/user/deepseek-harness.service` (cwd = harness repo, `web --no-open`).

## Smoke

1. **Bridge + Spyder** (без UI):

```sh
cd deepseek-harness
node plugins/dsh-ollama-redis-lease/scripts/local-lease-smoke.mjs
```

Ожидание: три строки `ollama-http-lease: acquired id=...` с **разными** id.

2. **UI**: Web `http://127.0.0.1:3080`, модель провайдера **ollama**, короткий prompt; в `journalctl --user -u deepseek-harness.service` те же `acquired id=`.

```sh
journalctl --user -u deepseek-harness.service -f | grep ollama-http-lease
```

## Откат

Убрать bundle и dependency из `package.json`, блок `ollama-redis-lease` из patch, `pnpm install`, `systemctl --user restart deepseek-harness.service`.

## Ссылки

- [[repo/doc/plugins/dsh-ollama-redis-lease/tz]]
- [[repo/doc/plugins/dsh-ollama-redis-lease/design]]
