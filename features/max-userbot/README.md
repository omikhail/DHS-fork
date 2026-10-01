# MAX userbot — транспортный слой (reference)

TypeScript-модули для userbot-сессии MAX (WebSocket). Используются как **исходник для порта** в `plugins/dsh-max-userbot/lib/`; в runtime DSH этот каталог не импортируется.

## Состав

| Путь | Роль |
|------|------|
| `helpers/normalizeMessage.ts` | text / voice / skip own messages |
| `transport/MaxClientManager.ts` | lifecycle клиента, reconnect, reply/send |
| `vendor/max-account-api/` | форк [maxsos1/max-account-api](https://github.com/maxsos1/max-account-api), **appVersion 26.32.1** (`FORK.md`) |
| `__tests__/` | unit-тесты normalize + manager (Jest) |

Слой UI/workflow (триггеры, credentials UI сторонней системы) **не** включён — в DSH заменяется `apply(ctx, config)` и `ctx.credentials`.

## Сборка форка API

```sh
cd features/max-userbot/vendor/max-account-api
npm install
npm run build
```

## Тесты (в этом каталоге)

```sh
cd features/max-userbot
npm install   # при добавлении package.json в плагине — пока запуск из корня копии
# после переноса зависимостей в plugins/dsh-max-userbot:
npm test
```

Лицензии: MIT (`vendor/max-account-api/LICENSE`).
