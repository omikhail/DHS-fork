# `features/` — исходники под будущие `@mikhail/*` плагины

Каталог **не** входит в Cordis bundles и не подключается из `~/.dsh` напрямую. Здесь лежит проверенный транспортный код, который переносится в `plugins/<name>/` при реализации плагина.

| Каталог | Назначение | Потребитель |
|---------|------------|-------------|
| `max-userbot/` | MAX WebSocket userbot: `MaxClientManager`, `normalizeMessage`, форк `max-account-api` | `@mikhail/dsh-max-userbot` (см. [[repo/doc/plugins/dsh-max-userbot/tz]]) |

Не коммитить `node_modules/` в подкаталогах. Сборка `vendor/max-account-api`: `npm run build` внутри форка при необходимости.
