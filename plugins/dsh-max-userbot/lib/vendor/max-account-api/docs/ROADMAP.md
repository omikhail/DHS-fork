# Roadmap

Краткий список того, что реализовано в `max-account-api`.

## Авторизация

- [x] Phone-auth (SMS + опциональный 2FA)
- [x] QR-логин (терминал-QR)
- [x] Авто-QR-bind после phone-auth (получение web-токена)
- [x] Silent re-login по сохранённому токену
- [x] Резюм после неудачной qr-bind фазы (mobile-токен сохраняется сразу)
- [x] Управление 2FA (включить / выключить / re-verify)
- [x] `logout` с локальным wipe сессии
- [x] Список активных сессий + close по id

## Сообщения

- [x] Отправка текста
- [x] Reply (с цитатой)
- [x] Forward (с опциональным комментом)
- [x] Edit (в пределах серверного окна)
- [x] Delete (`forMe` / `forAll`)
- [x] Typing-indicator
- [x] Read-mark
- [x] История чата
- [x] Поиск по чату / global / по типу
- [x] Реакции: set, remove, get, list
- [x] Серверный push → событие `'message'` (с авто-ack)
- [x] Получить сообщение по id
- [x] Транскрипция voice / audio (запрос; результат прилетит push'ем)

## Вложения

- [x] Photo: end-to-end upload + send
- [x] File: upload + send (с await `fileUploadDone` push)
- [x] Video: upload + send (через mobile binary)
- [x] Video-note (круглый кружок)
- [x] Voice / audio (.opus / .ogg / .mp3 / .m4a / .aac, авто-waveform через ffmpeg)
- [x] Sticker: send
- [x] Контакт: send
- [x] Location: send
- [x] Опросы: send + vote + get
- [x] Resolve внешнего видео (OK / VK preview)
- [x] Resolve файла download URL

## Чаты / группы / каналы

- [x] Чаты на логине + sync по marker
- [x] Get chats by ids
- [x] Create group / channel
- [x] Rename, set avatar, set description
- [x] Add / remove members
- [x] Promote / demote admin
- [x] Permissions (`setGroupOptions`)
- [x] Pin / unpin message
- [x] Revoke invite link
- [x] Channel join-request toggle
- [x] Leave chat
- [x] Mute / unmute
- [x] Clear history (op 54)
- [x] Delete chat (op 52)
- [x] Resolve / join по публичной ссылке
- [x] Members list (paginated, admins-only filter)
- [x] Per-chat reactions policy
- [x] Common chats with user
- [x] Folders: get, upsert, reorder

## Контакты / профиль

- [x] Lookup by phone
- [x] Add by phone
- [x] Rename / block / unblock / remove
- [x] List by status (blocked / verified / pending)
- [x] Поиск среди своих контактов (op 37)
- [x] Mutual contacts (op 38)
- [x] Presence (one-shot + push)
- [x] Update own profile (name / description / avatar)
- [x] Profile-change push

## Звонки

- [x] 1:1 audio / video `startCall` (signalling)
- [x] Call history
- [ ] WebRTC media bridge (`videowebrtc.okcdn.ru`) — вне scope: отдельный медиа-протокол

## Боты / mini-apps

- [x] Открыть bot mini-app
- [x] Bot info / commands list
- [x] Жалобы (категории + отправка)

## Drafts

- [x] Save / discard draft

## Транспорт

- [x] WebSocket (JSON)
- [x] Mobile binary (msgpack + LZ4)
- [x] Auto-reconnect с exponential backoff
- [x] Silent re-handshake после reconnect
- [x] LZ4-decompression на mobile binary RX
- [x] Canonical opcode names (после декомпиляции Android-клиента)

## Известные ограничения

- SMS-доставка для phone-auth работает только с RU-IP (сервер блокирует другие регионы).
- Live-streams (op 62): только метаданные, инициация стрима не реализована.
- TLS-fingerprint MAX (Conscrypt) отличается от Node.js TLS — на практике принимается, но MAX может ужесточить.
- Rate-limiting — не встроен; на стороне приложения стоит throttle'ить (~50–100 msg/min на чат, ~1 req/s на пользователя).
