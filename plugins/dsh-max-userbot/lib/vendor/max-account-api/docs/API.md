# max-account-api — справочник API

> Версия библиотеки `0.1.0`. Все методы — на классе `MaxClient` (если не указано иначе). Низкоуровневые helper'ы и типы экспортируются из корня пакета.

```ts
import { MaxClient } from 'max-account-api';
```

---

## Оглавление

- [Авторизация](#auth)
  - [`MaxClient.loginWithPhone()`](#loginWithPhone)
  - [`new MaxClient()` + `start()`](#start)
  - [`stop()`](#stop)
  - [`logout()`](#logout)
- [Геттеры состояния](#state)
  - [`getMe()`](#getMe)
  - [`getChats()`](#getChats)
- [Сообщения](#messages)
  - [`sendMessage()`](#sendMessage)
  - [`reply()`](#reply)
  - [`sendReply()`](#sendReply)
  - [`editMessage()`](#editMessage)
  - [`deleteMessages()`](#deleteMessages)
  - [`forwardMessage()`](#forwardMessage)
  - [`getMessage()`](#getMessage)
  - [`getHistory()`](#getHistory)
  - [`getHistoryByAttach()`](#getHistoryByAttach)
  - [`searchMessages()`](#searchMessages)
  - [`getMessageStats()`](#getMessageStats)
  - [`readMessage()`](#readMessage)
  - [`sendTyping()`](#sendTyping)
- [Реакции](#reactions)
  - [`setReaction()`](#setReaction)
  - [`removeReaction()`](#removeReaction)
  - [`getReactions()`](#getReactions)
  - [`listReactions()`](#listReactions)
- [Медиа: фото / файл / голос / видео / стикер](#media)
  - [`uploadPhotoBytes()` + `sendPhoto()`](#sendPhoto)
  - [`uploadFileBytes()` + `sendFile()`](#sendFile)
  - [`uploadAudioBytes()` + `sendVoice()`](#sendVoice)
  - [`uploadVideoBytes()` + `sendVideo()` / `sendVideoNote()`](#sendVideo)
  - [`sendSticker()`](#sendSticker)
  - [`sendContact()`](#sendContact)
  - [`sendLocation()`](#sendLocation)
  - [`sendPoll()` / `votePoll()` / `getPolls()`](#polls)
  - [`transcribeMedia()`](#transcribeMedia)
  - [`getFileDownloadUrl()`](#getFileDownloadUrl)
  - [`resolveExternalVideo()`](#resolveExternalVideo)
  - [Низкоуровневые upload-URL helpers](#uploadUrlHelpers)
- [Чаты](#chats)
  - [`getChatsByIds()`](#getChatsByIds)
  - [`syncChats()`](#syncChats)
  - [`resolveChatLink()`](#resolveChatLink)
  - [`subscribeChat()`](#subscribeChat)
  - [`openChat()`](#openChat)
  - [`muteChat()` / `unmuteChat()`](#muteChat)
  - [`clearChatHistory()`](#clearChatHistory)
  - [`deleteChat()`](#deleteChat)
  - [`leaveChat()`](#leaveChat)
- [Группы / каналы](#groups)
  - [`createGroup()`](#createGroup)
  - [`addGroupParticipants()` / `removeGroupParticipant()`](#addRemoveParticipants)
  - [`setGroupAdmin()` / `removeGroupAdmin()`](#groupAdmin)
  - [`updateChatSettings()` + сахар (`renameGroup`, `pinMessage`, …)](#updateChatSettings)
  - [`listMembers()`](#listMembers)
  - [`setChatReactionsPolicy()` / `getChatReactionsPolicies()`](#chatReactions)
- [Контакты](#contacts)
  - [`getContactInfo()` / `getContactsInfo()`](#getContactInfo)
  - [`getPresence()`](#getPresence)
  - [`addContactByPhone()` / `lookupContactByPhone()`](#contactByPhone)
  - [`searchContacts()`](#searchContacts)
  - [`getMutualContacts()` / `getCommonChats()`](#mutual)
  - [`blockContact()` / `unblockContact()` / `renameContact()` / `removeContact()`](#contactActions)
  - [`listContactsByStatus()` / `listBlockedContacts()`](#listContacts)
- [Профиль](#profile)
  - [`updateProfile()` + сахар (`setProfileName`, `setProfileDescription`, `setProfileAvatar`)](#updateProfile)
- [Настройки](#settings)
  - [`updateSettings()` / `setUserSettings()`](#updateSettings)
- [Поиск](#search)
  - [`globalSearch()` / `globalSearchByType()`](#globalSearch)
  - [`previewLink()`](#previewLink)
- [Звонки](#calls)
  - [`startCall()`](#startCall)
  - [`getCallHistory()`](#getCallHistory)
- [Папки](#folders)
  - [`getFolders()` / `upsertFolder()` / `reorderFolders()`](#folders-methods)
- [Сессии / безопасность](#sessions)
  - [`listSessions()` / `closeSession()`](#listSessions)
  - [`enable2faPassword()` / `disable2faPassword()` / `verify2faPassword()`](#twoFa)
  - [`refreshWebToken()`](#refreshWebToken)
- [Боты / mini-apps](#bots)
  - [`openBotMiniApp()` / `getBotInfo()` / `getBotCommands()`](#botInfo)
- [Stickers / assets](#stickers)
  - [`favoriteStickerPack()` / `unfavoriteStickerPack()`](#favoriteStickerPack)
- [Drafts](#drafts)
  - [`saveDraft()` / `discardDraft()`](#draftMethods)
- [Низкоуровневое](#lowLevel)
  - [`raw()`](#raw)
  - [`keepalive()`](#keepalive)
  - [`logEvents()`](#logEvents)
- [События](#events)
- [Типы](#types)
- [Низкоуровневые экспорты](#exports)

---

<a id="auth"></a>
## 🔐 Авторизация

<a id="loginWithPhone"></a>
### `MaxClient.loginWithPhone(opts): Promise<MaxClient>` &nbsp; *(static)*

Single-call логин по номеру телефона с автоматическим QR-bind для web-сессии. На первом запуске зайдёт mobile-protocol'ом, попросит SMS-код, опционально 2FA, и подключит готовый WS-клиент. На последующих — silent reconnect.

**Параметры (`PhoneLoginOptions & ClientOptions`)**

| Поле | Тип | Default | Описание |
|---|---|---|---|
| `phone` | `string \| () => Promise<string>` | — | Номер в E.164. Callback вызывается только когда сессия пустая. |
| `getSmsCode` | `() => Promise<string>` | — | Callback для ввода кода из SMS. |
| `getPassword` | `(challenge: PasswordChallenge) => Promise<string \| null>` | — | Опционально — нужен только при 2FA. `null` отменяет вход. |
| `sessionFile` | `string` | `./.max-session.json` | Где хранить токены. |
| `session` | `SessionStore` | — | Свой store вместо файла. |
| `debug` | `boolean` | `false` | Hex-dump mobile binary TX/RX в stderr. |
| + все поля `ClientOptions` | | | См. [`new MaxClient()`](#start). |

**Возвращает** `Promise<MaxClient>` — уже залогиненный, `start()` вызывать не надо.

**Пример**

```ts
const client = await MaxClient.loginWithPhone({
  phone: () => readline('Phone: '),
  getSmsCode: () => readline('SMS: '),
  getPassword: (c) => readline(`2FA (hint: ${c.hint}): `),
});
client.on('message', m => console.log(m.text));
await client.sendMessage(0, 'hi');
```

**Опкоды под капотом**: 6 → 17 → 18 → 115 (если 2FA) → 19 (mobile-bind) → 290 (QR confirm) → 288 / 289 / 291 → 115 (web 2FA) → 19 (web login).

---

<a id="start"></a>
### `new MaxClient(opts?: ClientOptions)` + `client.start()`

QR-login flow. Используйте, когда не хотите вводить номер.

**`ClientOptions`**

| Поле | Тип | Default | Описание |
|---|---|---|---|
| `url` | `string` | `wss://ws-api.oneme.ru/websocket` | Override WS endpoint |
| `session` | `SessionStore` | `new FileSessionStore()` | Хранилище токенов |
| `deviceId` | `string` | — | Inline-кред. Включает `MemorySessionStore`. |
| `loginToken` | `string` | — | Inline-кред (web-bound LOGIN). |
| `sessionFile` | `string` | `./.max-session.json` | Путь файла для дефолтного store |
| `userAgent` | `UserAgent` | bundled WEB | Спуф-UA |
| `printQr` | `boolean` | `true` | Печатать QR в stdout при первом логине |
| `printCredentialsAfterLogin` | `boolean` | `true` | Показать `deviceId+loginToken` после QR |
| `autoRead` | `boolean` | `false` | Автоматически отмечать входящие как прочитанные |
| `chatsCount` | `number` | `40` | Сколько чатов вернуть на логине |
| `pingIntervalMs` | `number` | `30000` | Интервал heartbeat |
| `requestTimeoutMs` | `number` | `20000` | Таймаут одного запроса |
| `resolvePassword` | `(challenge) => Promise<string\|null>` | — | Callback для 2FA в QR-flow |

```ts
const client = new MaxClient();
client.on('qr', ({ link, expiresAt }) => console.log('Scan:', link));
client.on('ready', () => console.log('Logged in.'));
await client.start();
```

---

<a id="stop"></a>
### `client.stop(): Promise<void>`

Закрывает WS, останавливает реконнект. Локально сессия не трогается — токен можно использовать снова.

---

<a id="logout"></a>
### `client.logout(): Promise<void>`

Op 20. **Инвалидирует токен на сервере** + локально стирает `loginToken` из session-store. Закрывает соединение. Следующий `start()` потребует свежий логин.

---

<a id="state"></a>
## 📊 Геттеры состояния

<a id="getMe"></a>
### `client.getMe(): ContactInfo | null`

Залогиненный пользователь. Доступен после события `ready`. До этого — `null`.

<a id="getChats"></a>
### `client.getChats(): MaxChat[]`

Снимок чатов на момент логина. Не обновляется автоматически — для свежих данных используйте [`getChatsByIds()`](#getChatsByIds) или [`syncChats()`](#syncChats).

---

<a id="messages"></a>
## 💬 Сообщения

<a id="sendMessage"></a>
### `client.sendMessage(chatId, text, opts?): Promise<MaxMessage>`

Основной метод отправки. `chatId = 0` — Saved Messages.

| Параметр | Тип | Default | Описание |
|---|---|---|---|
| `chatId` | `number` | — | id чата. `0` — Saved Messages. |
| `text` | `string` | — | Текст сообщения. |
| `opts` | `Partial<OutgoingMessage>` | `{}` | `{elements?, attaches?, link?, cid?}` |

**Возвращает** `MaxMessage` — серверная копия с присвоенным `id` и `time`.

**Опкод**: 64 (`MSG_SEND`)

```ts
const m = await client.sendMessage(0, 'Привет!');
console.log('Sent:', m.id);
```

<a id="reply"></a>
### `client.reply(incoming, text): Promise<MaxMessage>`

Отправить сообщение в тот же чат, откуда пришло `incoming`. Удобный wrapper для обработчика `'message'`.

```ts
client.on('message', m => client.reply(m, `echo: ${m.text}`));
```

<a id="sendReply"></a>
### `client.sendReply(chatId, replyToMessageId, text): Promise<MaxMessage>`

Отправить ответ-цитату (с превью оригинала). Серверный `link.type:'REPLY'`.

<a id="editMessage"></a>
### `client.editMessage(chatId, messageId, text, opts?): Promise<MaxMessage>`

Редактировать своё сообщение. Окно редактирования — 7 дней (`edit-timeout` серверной конфигурации).

| Поле `opts` | Тип | Описание |
|---|---|---|
| `elements` | `MessageElement[]` | Форматирование (bold, italic, code, link, …) |
| `attachments` | `MessageAttach[]` | Заменить вложения |

**Опкод**: 67 (`MSG_EDIT`)

<a id="deleteMessages"></a>
### `client.deleteMessages(chatId, messageIds, forMe?): Promise<DeleteMessagesResponse>`

| Параметр | Тип | Описание |
|---|---|---|
| `chatId` | `number` | id чата |
| `messageIds` | `string[]` | id'шники сообщений |
| `forMe` | `boolean` (default `false`) | `true` — удалить только у себя. `false` — для всех. Требует admin-прав для чужих сообщений в группе. |

**Опкод**: 66 (`MSG_DELETE`)

<a id="forwardMessage"></a>
### `client.forwardMessage(toChatId, sourceChatId, messageId, comment?): Promise<MaxMessage>`

Переслать сообщение. Опциональный `comment` идёт отдельным сообщением перед форвардом.

<a id="getMessage"></a>
### `client.getMessage(chatId, messageId): Promise<MaxMessage | undefined>`

Получить одно сообщение по id (op 71 `MSG_GET`). Вернёт `undefined` если удалено / нет доступа.

<a id="getHistory"></a>
### `client.getHistory(chatId, opts?): Promise<MaxMessage[]>`

| Поле `opts` | Тип | Default | Описание |
|---|---|---|---|
| `from` | `number` | `Date.now()` | Опорная точка (timestamp ms) |
| `backward` | `number` | `30` | Сколько сообщений ДО `from` вернуть |
| `forward` | `number` | `0` | Сколько ПОСЛЕ |

**Опкод**: 49 (`CHAT_HISTORY`)

<a id="getHistoryByAttach"></a>
### `client.getHistoryByAttach(chatId, messageId, attachTypes, opts?): Promise<MaxMessage[]>`

Соседние сообщения, отфильтрованные по типу вложения — используется при пролистывании фото / файлов в чате.

| Параметр | Тип | Описание |
|---|---|---|
| `attachTypes` | `Array<'PHOTO' \| 'VIDEO' \| 'FILE' \| 'AUDIO' \| 'SHARE'>` | Какие типы оставить |
| `opts.forward` | `number` (default `25`) | Сколько после `messageId` |
| `opts.backward` | `number` (default `25`) | Сколько до |

**Опкод**: 51 (`HISTORY_BY_ATTACH`)

<a id="searchMessages"></a>
### `client.searchMessages(chatId, query, count?): Promise<MessageSearchHit[]>`

Поиск по тексту внутри одного чата. Op 73 (`MSG_SEARCH`).

<a id="getMessageStats"></a>
### `client.getMessageStats(chatId, messageIds): Promise<Record<string, {views: number}>>`

Счётчик просмотров для постов в каналах (op 74 `MSG_GET_STAT`).

<a id="readMessage"></a>
### `client.readMessage(chatId, messageId, mark?): Promise<void>`

Отметить как прочитанное. `mark` — timestamp (по умолчанию `Date.now()`).

<a id="sendTyping"></a>
### `client.sendTyping(chatId, type?): Promise<void>`

| `type` | Описание |
|---|---|
| `'TEXT'` (default) | «печатает…» |
| `'AUDIO'` | «записывает голосовое» |
| `'PHOTO'` | «отправляет фото» |
| `'FILE'` | «отправляет файл» |

Повторяйте каждые ~3 секунды чтобы индикатор не пропадал.

---

<a id="reactions"></a>
## ❤️ Реакции

<a id="setReaction"></a>
### `client.setReaction(chatId, messageId, emoji): Promise<ReactionInfo>`

Поставить (или заменить — повторный вызов с другим эмодзи upsert'ит) реакцию.

```ts
await client.setReaction(chatId, msgId, '👍');
await client.setReaction(chatId, msgId, '❤️');  // заменит 👍
```

**Опкод**: 178 (`MSG_REACTION`)

<a id="removeReaction"></a>
### `client.removeReaction(chatId, messageId): Promise<ReactionInfo>`

Убрать свою реакцию. Op 179.

<a id="getReactions"></a>
### `client.getReactions(chatId, messageIds): Promise<Record<string, ReactionInfo>>`

Батчевый запрос: суммарные счётчики по нескольким сообщениям. Op 180.

<a id="listReactions"></a>
### `client.listReactions(chatId, messageId, count?): Promise<ReactionInfo>`

Детальный список — с реактиром по каждому пользователю. Op 181. `count` (default `100`) — сколько reactor-записей вернуть.

---

<a id="media"></a>
## 📎 Медиа

<a id="sendPhoto"></a>
### Photo

#### `client.uploadPhotoBytes(file): Promise<string>`
Загрузить файл-изображение и получить `photoToken`. Объединяет op 80 (запрос URL) + HTTPS multipart POST.

| Поле `file` | Тип | Описание |
|---|---|---|
| `data` | `Uint8Array \| ArrayBuffer \| Blob` | Байты фото |
| `filename` | `string` | Имя файла (для определения mime сервером) |
| `contentType` | `string?` | Override mime (если auto-detect не справился) |

#### `client.sendPhoto(chatId, photoToken, caption?): Promise<MaxMessage>`
Прикрепить уже загруженное фото и отправить.

```ts
const token = await client.uploadPhotoBytes({ data: bytes, filename: 'pic.png' });
await client.sendPhoto(chatId, token, 'смотри!');
```

---

<a id="sendFile"></a>
### File

#### `client.uploadFileBytes(file): Promise<FileUploadInfo>`
Загружает файл и ждёт серверный push op 136 (`fileUploadDone`) перед возвратом — гарантия что файл готов к отправке.

#### `client.sendFile(chatId, fileId, caption?): Promise<MaxMessage>`

```ts
const info = await client.uploadFileBytes({ data: pdfBytes, filename: 'doc.pdf' });
await client.sendFile(chatId, info.fileId, 'договор');
```

---

<a id="sendVoice"></a>
### Voice

#### `client.sendVoice(chatId, audio, opts?): Promise<MaxMessage>`

Нативное голосовое сообщение MAX (с waveform-UI у получателя). Делает полный цикл в **одной mobile-binary сессии**: HELLO + LOGIN с `mobileLoginToken` → op 82 audio-вариант (`{uploaderType:1, type:2}`) → `POST application/octet-stream` на `au.oneme.ru/uploadAudio` → op 64 MSG_SEND с AUDIO-аттачем. WS-сессия не годится — токены, выданные op 82 на mobile, не валидны на WS-стороне.

Wire-формат attach (подтверждён захватом `ru.oneme.app` v26.15.1):
```
{ _type: 'AUDIO', token, duration: <ms>, wave: <80-byte Uint8Array> }
```

**Требуется:** session, полученная через `MaxClient.loginWithPhone()` — нужен `mobileLoginToken`. Голосовые недоступны через QR-only login.

**Формат аудио:** opus / ogg / mp3 / m4a / aac. **WAV PCM сервер отвергает** (`video.not.supported`). Лучший выбор — opus в Ogg (как пишет сам мобильный клиент):
```bash
ffmpeg -i in.wav -ar 16000 -ac 1 -c:a libopus -b:a 24k voice.ogg
```

**Waveform:** если `opts.wave` не передан и `ffmpeg` есть в PATH — библиотека сама вычислит 80-байтовый waveform из аудио. Без ffmpeg — у получателя плоская полоса (звук всё равно играет).

| Поле | Тип | Описание |
|---|---|---|
| `audio.data` | `Uint8Array \| ArrayBuffer \| Blob` | Байты аудио-файла |
| `audio.filename` | `string?` | Не критичен — сервер игнорирует |
| `opts.duration` | `number?` | Длительность в **секундах** (удобная форма — авто × 1000) |
| `opts.durationMs` | `number?` | Длительность в **миллисекундах** (как на wire) — приоритет над `duration` |
| `opts.wave` | `Uint8Array?` | 80-байтный waveform. Опустишь — авто-вычислим через ffmpeg |
| `opts.cid` | `number?` | Client-side message id (для дедупа). Авто-генерируется |

```ts
const data = await fs.readFile('voice.ogg');
await client.sendVoice(0, { data, filename: 'voice.ogg' }, { duration: 12 });
```

#### `client.uploadAudioBytes(file): Promise<{ token: string }>`
Low-level хук: только upload (op 82 audio variant + POST). Возвращённый `token` действителен **только в той же mobile-сессии** — отправить через WS его нельзя, поэтому в обычном flow используй `sendVoice` (он сам делает upload+send атомарно).

---

<a id="sendVideo"></a>
### Video

#### `client.sendVideo(chatId, video, caption?, opts?): Promise<MaxMessage>`
Обычное видео-сообщение. Wire-attach: `{_type:'VIDEO', token, thumbhash}`.

#### `client.sendVideoNote(chatId, video, opts?): Promise<MaxMessage>`
**Круглый видео-кружок** (square, ≤ 60 s). Тот же attach + флаг `videoType: 1`.

Оба метода делают полный цикл в одной mobile-binary сессии: op 82 (`{uploaderType:0, type:1}`) → `POST application/x-binary` на OK-CDN (`vu.okcdn.ru/upload.do` с заголовками `Content-Disposition: attachment; fileName="…"`, `Content-Range`, `X-Uploading-Mode: parallel`) → op 64 с VIDEO-аттачем. WS-токены здесь не годятся (как и для voice).

| Поле | Тип | Описание |
|---|---|---|
| `video.data` | `Uint8Array \| ArrayBuffer \| Blob` | Байты видео-файла (`.mp4` и т.п.) |
| `video.filename` | `string?` | Не критичен — сервер игнорирует |
| `caption` | `string?` | Только для `sendVideo`; у video-note подпись запрещена |
| `opts.thumbhash` | `Uint8Array?` | Превью-хеш. Опустишь — сервер сгенерирует сам |
| `opts.cid` | `number?` | Client-side message id (для дедупа). Авто-генерируется |

```ts
const data = await fs.readFile('clip.mp4');
await client.sendVideo(chatId, { data, filename: 'clip.mp4' }, 'смотри ролик');
// или круглый кружок:
await client.sendVideoNote(chatId, { data, filename: 'note.mp4' });
```

#### `client.uploadVideoBytes(file): Promise<{ token: string }>`
Low-level: только upload без MSG_SEND. Токен валиден только в той же mobile-сессии, поэтому в обычном flow используй `sendVideo` / `sendVideoNote` (они делают upload+send атомарно).

---

<a id="sendSticker"></a>
### Sticker

#### `client.sendSticker(chatId, stickerId): Promise<MaxMessage>`
`stickerId` берётся из стикерпаков (op 26 ASSETS_GET / op 28 ASSETS_GET_BY_IDS).

---

<a id="sendContact"></a>
### Contact

#### `client.sendContact(chatId, contactId, caption?): Promise<MaxMessage>`
Поделиться контактом из своей адресной книги.

---

<a id="sendLocation"></a>
### Location

#### `client.sendLocation(chatId, latitude, longitude, opts?): Promise<MaxMessage>`

| Поле `opts` | Тип | Описание |
|---|---|---|
| `name` | `string?` | Подпись места (например, «Красная площадь») |
| `address` | `string?` | Адрес |

```ts
await client.sendLocation(chatId, 55.7558, 37.6173, { name: 'Кремль' });
```

---

<a id="polls"></a>
### Polls

#### `client.sendPoll(chatId, title, answers, settings?): Promise<MaxMessage>`

| Параметр | Тип | Default | Описание |
|---|---|---|---|
| `title` | `string` | — | Вопрос опроса |
| `answers` | `string[]` | — | Варианты ответа |
| `settings` | `number` | `4` | Bitmask: `4` — anonymous; `12` — anonymous + публичный список голосов |

#### `client.votePoll(chatId, messageId, pollId, answerIds): Promise<PollState>`
`answerIds: [0]` — за первый вариант; multi-choice опросы принимают массив.

#### `client.getPolls(chatId, polls): Promise<PollInfo[]>`
Текущее состояние опросов. `polls: [{messageId, pollId}, …]`

---

<a id="transcribeMedia"></a>
### `client.transcribeMedia(chatId, messageId): Promise<void>`

Запросить транскрипцию голосового / аудио сообщения (op 202). Результат прилетит асинхронно push'ем `NOTIF_TRANSCRIPTION` (op 293) — слушайте через событие `'raw'`.

---

<a id="getFileDownloadUrl"></a>
### `client.getFileDownloadUrl(fileId, chatId, messageId): Promise<FileDownloadUrlResponse>`

CDN-URL для скачивания файла из чужого сообщения (op 88).

<a id="resolveExternalVideo"></a>
### `client.resolveExternalVideo(videoId, token, chatId, messageId): Promise<ExternalVideoResolveResponse>`

Разрешить URL внешнего видео (OK / VK preview) в формат для встроенного плеера (op 83).

---

<a id="uploadUrlHelpers"></a>
### Низкоуровневые upload-URL helpers

Если нужен полный контроль над upload pipeline'ом (например, паузы / progress / chunked upload):

| Метод | Опкод | Возвращает |
|---|---|---|
| `client.requestPhotoUploadUrl(count?)` | 80 | `string` — HTTPS-URL для multipart POST |
| `client.requestFileUploadUrl(count?)` | 87 | `FileUploadInfo[]` — `{url, fileId, token}` на каждый слот |
| `client.requestVideoUploadUrl(count?, opts?)` | 82 | `VideoUploadInfo[]` — `{url, videoId, token}` |

`requestVideoUploadUrl` с `{uploaderType, type}` уходит через mobile binary (нужен `mobileLoginToken`); без них — WS-путь (выдаёт только video URL).

---

<a id="chats"></a>
## 💬 Чаты

<a id="getChatsByIds"></a>
### `client.getChatsByIds(chatIds): Promise<MaxChat[]>`
Свежие метаданные чатов по их id (op 48).

<a id="syncChats"></a>
### `client.syncChats(marker): Promise<MaxChat[]>`
Инкрементальный синк: вернёт чаты с `modified > marker` (op 53). Используйте максимальный `chat.modified` из предыдущей выборки.

<a id="resolveChatLink"></a>
### `client.resolveChatLink(link): Promise<MaxChat>`
Резолвит публичную ссылку `https://max.ru/<slug>` или invite-линк в `MaxChat` (op 57 — канонически `CHAT_JOIN`). **Внимание**: эта операция фактически вступает в чат на сервере. Если нужно только посмотреть без вступления — используйте [`raw(Opcode.CHAT_CHECK_LINK, {link})`](#raw) (op 56).

<a id="subscribeChat"></a>
### `client.subscribeChat(chatId, subscribe): Promise<void>`
Подписаться / отписаться от push'ей чата (op 75).

<a id="openChat"></a>
### `client.openChat(chatId): Promise<void>`
"Открыть" чат — web-клиент шлёт это перед фокусировкой UI (op 72 `MSG_SEARCH_TOUCH`).

<a id="muteChat"></a>
### `client.muteChat(chatId, muteUntilMs?): Promise<SettingsResponse>`

| `muteUntilMs` | Эффект |
|---|---|
| `-1` (default) или omit | Замьютить навсегда |
| `0` | Размьютить |
| `> 0` | Замьютить до этого timestamp |

#### `client.unmuteChat(chatId): Promise<SettingsResponse>`
Алиас `muteChat(chatId, 0)`.

<a id="clearChatHistory"></a>
### `client.clearChatHistory(chatId, forAll?, lastEventTimeMs?): Promise<void>`
Op **54** (`CHAT_CLEAR`). Очистить историю, оставив чат в списке.

<a id="deleteChat"></a>
### `client.deleteChat(chatId, forAll?, lastEventTimeMs?): Promise<void>`
Op **52** (`CHAT_DELETE`). Полностью удалить чат.

<a id="leaveChat"></a>
### `client.leaveChat(chatId): Promise<MaxMessage>`
Покинуть группу / канал (op 58). Сервер постит service-сообщение.

---

<a id="groups"></a>
## 👥 Группы / каналы

<a id="createGroup"></a>
### `client.createGroup(title, userIds, opts?): Promise<SendMessageResponse & {chat?: MaxChat}>`

| `opts.chatType` | Default | Описание |
|---|---|---|
| `'CHAT'` | ✓ | Обычная группа |
| `'CHANNEL'` | | Канал (1-к-многим) |

```ts
const res = await client.createGroup('Test', [296080093]);
console.log('Group id:', res.chatId);
```

<a id="addRemoveParticipants"></a>
### `client.addGroupParticipants(chatId, userIds, showHistory?): Promise<MaxChat>`
`showHistory` (default `true`) — новые участники видят предыдущие сообщения. Op 77.

### `client.removeGroupParticipant(chatId, userId, cleanMsgPeriod?): Promise<MaxChat>`
`cleanMsgPeriod` (sec) — сколько последних сообщений участника удалить. `0` — оставить всё.

<a id="groupAdmin"></a>
### `client.setGroupAdmin(chatId, userId, permissions?): Promise<MaxChat>`
`permissions` — bitmask, `255` (default) — все права.

### `client.removeGroupAdmin(chatId, userId): Promise<MaxChat>`

<a id="updateChatSettings"></a>
### `client.updateChatSettings(chatId, patch): Promise<MaxChat>`

Универсальный апдейтер настроек чата (op 55).

| Поле в `patch` | Тип | Описание |
|---|---|---|
| `theme` | `string` | Название чата |
| `description` | `string` | Bio / описание |
| `photoToken` | `string` | Новый аватар |
| `pinMessageId` | `string` | Закрепить сообщение (`""` — снять закреп) |
| `notifyPin` | `boolean` | Постить «закреплено» |
| `revokePrivateLink` | `boolean` | Сгенерить новый invite-link |
| `options` | `ChatSettingsOptions` | Boolean-флаги — см. ниже |

`ChatSettingsOptions` — JOIN_REQUEST, ALL_CAN_PIN_MESSAGE, ONLY_ADMIN_CAN_CALL, и другие.

#### Удобные обёртки

```ts
await client.renameGroup(chatId, 'Новое имя', 'Опционально описание');
await client.setGroupOptions(chatId, { ONLY_ADMIN_CAN_CALL: true });
await client.pinMessage(chatId, msgId, /*notify*/ false);
await client.unpinMessage(chatId);
await client.setChatAvatar(chatId, photoToken);
await client.revokeChatInviteLink(chatId);
await client.setChannelJoinRequest(chatId, true);
```

<a id="listMembers"></a>
### `client.listMembers(chatId, opts?): Promise<MemberEntry[]>`

| `opts.type` | Default | Что вернуть |
|---|---|---|
| `'MEMBER'` | ✓ | Всех участников |
| `'ADMIN'` | | Только админов |

| `opts.marker` | `0` | Курсор пагинации |
| `opts.count` | `50` | Размер страницы |

<a id="chatReactions"></a>
### `client.setChatReactionsPolicy(chatId, cfg): Promise<ChatReactionsSettings>`

Op 257 (`CHAT_REACTIONS_SETTINGS_SET`).

| Поле `cfg` | Тип | Описание |
|---|---|---|
| `value` | `boolean` | Включены ли реакции в чате |
| `included` | `boolean?` | `true` — белый список, `false` — все эмодзи |
| `reactionIds` | `string[]?` | Конкретный набор разрешённых эмодзи |
| `count` | `number?` | Max реакций на сообщение (1 / 2) |

Примеры:
```ts
await client.setChatReactionsPolicy(id, { value: false });                    // disable
await client.setChatReactionsPolicy(id, { value: true, included: false, count: 2 }); // any
await client.setChatReactionsPolicy(id, {
  value: true, included: true, reactionIds: ['👍','❤️'], count: 1,
});                                                                            // whitelist
```

### `client.getChatReactionsPolicies(chatIds): Promise<ChatReactionsSettings[]>`
Op 258.

---

<a id="contacts"></a>
## 👤 Контакты

<a id="getContactInfo"></a>
### `client.getContactInfo(contactId): Promise<ContactInfo | undefined>` &nbsp; / &nbsp; `getContactsInfo(contactIds): Promise<ContactInfo[]>`
Op 32. Батч-friendly.

<a id="getPresence"></a>
### `client.getPresence(contactIds): Promise<{presence: {…}, time: number}>`
Op 35. One-shot. Серверные push'и `op 132 NOTIF_PRESENCE` приходят автоматически для контактов в видимости — слушайте событие `'presence'`.

<a id="contactByPhone"></a>
### `client.lookupContactByPhone(phone): Promise<ContactInfo>`
Op 46. Резолв номера без сохранения как контакта.

### `client.addContactByPhone(phone, firstName?, lastName?): Promise<ContactAddByPhoneResponse>`
Op 41. Добавить в адресную книгу. Бросает если номер не зарегистрирован в MAX.

<a id="searchContacts"></a>
### `client.searchContacts(query, count?): Promise<ContactInfo[]>`
Op 37. Поиск среди уже сохранённых контактов по тексту (имя / номер).

<a id="mutual"></a>
### `client.getMutualContacts(userId): Promise<ContactInfo[]>`
Op 38. Общие контакты с пользователем.

### `client.getCommonChats(userId): Promise<CommonChatsResponse>`
Op 198. Общие чаты с пользователем.

<a id="contactActions"></a>
### `client.blockContact(id)` / `unblockContact(id)` / `renameContact(id, firstName, lastName?)` / `removeContact(id)`
Все на op 34 (`CONTACT_UPDATE`). Низкоуровневый вызов — `client.contactAction({contactId, action, …})`.

<a id="listContacts"></a>
### `client.listContactsByStatus(status, opts?): Promise<ContactInfo[]>`

| `status` | Что вернёт |
|---|---|
| `'BLOCKED'` | Заблокированные |
| `'ACTIVE'` | Активные |
| иной литерал | Передаётся серверу как есть (сервер знает дополнительные статусы) |

| `opts.count` | `100` | Размер страницы |
| `opts.from` | `0` | Offset |

### `client.listBlockedContacts(opts?)`
Алиас `listContactsByStatus('BLOCKED', opts)`.

---

<a id="profile"></a>
## 🧑 Профиль

<a id="updateProfile"></a>
### `client.updateProfile(patch): Promise<ContactInfo>`

Op 16. Подмножество полей:

| Поле | Тип | Описание |
|---|---|---|
| `firstName` | `string` | Имя |
| `lastName` | `string` | Фамилия |
| `description` | `string` | Био |
| `photoToken` | `string` | Аватар (из `uploadPhotoBytes`) |
| `avatarType` | `'USER_AVATAR'` | Тип (обязательно при `photoToken`) |

#### Удобные обёртки

```ts
await client.setProfileName('Имя', 'Фамилия');
await client.setProfileDescription('обо мне');
await client.setProfileAvatar(photoToken, 'Имя', 'Фамилия');  // firstName/lastName опциональны
```

---

<a id="settings"></a>
## ⚙️ Настройки

<a id="updateSettings"></a>
### `client.updateSettings(patch): Promise<SettingsResponse>`

Op 22. Универсальный сеттер — передавайте подмножество `{user?, chats?}`. Используется внутри [`muteChat()`](#muteChat) / [`unmuteChat()`](#muteChat) / [`setUserSettings()`](#setUserSettings).

### `client.setUserSettings(user: UserSettings): Promise<SettingsResponse>`

Сахар над `updateSettings({user})`. Поля включают: `SEARCH_BY_PHONE`, `INCOMING_CALL`, `CHATS_INVITE`, `PHONE_NUMBER_PRIVACY` (значения `'ALL' | 'CONTACTS' | 'NOBODY'`), `SHOW_READ_MARK`, `PUSH_SOUND`, `INACTIVE_TTL` и многие другие — см. `UserSettings` в `src/types.ts`.

```ts
await client.setUserSettings({
  PHONE_NUMBER_PRIVACY: 'CONTACTS',
  SHOW_READ_MARK: false,
});
```

---

<a id="search"></a>
## 🔍 Поиск

<a id="globalSearch"></a>
### `client.globalSearch(query, opts?): Promise<GlobalSearchResponse>`
Op 68. Возвращает разделы (чаты, каналы, контакты, …) с пагинацией через `marker`.

### `client.globalSearchByType(query, type, count?): Promise<GlobalSearchHit[]>`

| `type` (литералы `GlobalSearchSection`) | Что вернёт |
|---|---|
| `'PUBLIC_CHATS'` | Публичные чаты |
| `'PRIVATE_CHATS'` | Личные диалоги |
| `'CHANNELS'` | Каналы |
| `'GROUPS'` | Группы |
| `'USERS'` | Пользователи |
| `'BOTS'` | Боты |
| `'ALL'` | Все разделы (то же что `globalSearch`) |

Op 60.

<a id="previewLink"></a>
### `client.previewLink(text): Promise<MessageAttach[]>`
Op 70. Серверный URL-preview. Результат — массив `SHARE` attach'ей готовых для `sendMessage(.., {attaches})`.

---

<a id="calls"></a>
## 📞 Звонки

<a id="startCall"></a>
### `client.startCall(calleeId, opts?): Promise<{conversationId, caller, raw}>`

Инициировать 1:1 audio/video звонок (op 78). Возвращает signalling info — медиа-поток идёт через отдельный `videowebrtc.okcdn.ru` (вне scope библиотеки).

| `opts.isVideo` | `false` | `true` — видео-звонок |
| `opts.deviceId` | session.deviceId | Спуф device-id |
| `opts.conversationId` | randomUUID() | Override id разговора |

<a id="getCallHistory"></a>
### `client.getCallHistory(opts?): Promise<CallHistoryEntry[]>`
Op 79.

| `opts.count` | `100` | Размер страницы |
| `opts.forward` | `false` | `false` — от новых к старым |
| `opts.marker` | `undefined` | Курсор |

---

<a id="folders"></a>
## 📁 Папки

<a id="folders-methods"></a>
```ts
const folders = await client.getFolders(['16d9faa1-...']);                  // op 273
await client.upsertFolder({                                                  // op 274
  id: 'existing-or-new-uuid',
  title: 'Боты',
  include: [],
  filters: [10],
  options: [],
  favorites: [],
});
await client.reorderFolders(['id-1', 'id-2', 'id-3']);                       // op 275
```

---

<a id="sessions"></a>
## 🔐 Сессии / безопасность

<a id="listSessions"></a>
### `client.listSessions(): Promise<ActiveSession[]>`
Op 96.

### `client.closeSession(sessionId): Promise<void>`
Op 97. Закрыть **другую** сессию по id. Свою текущую — через [`logout()`](#logout).

<a id="twoFa"></a>
### Управление 2FA

#### `client.enable2faPassword(opts): Promise<void>`

| Поле | Тип | Описание |
|---|---|---|
| `password` | `string` | Новый облачный пароль (6-64 символа) |
| `hint` | `string` | Подсказка (≤30 символов) |
| `recoveryEmail` | `string` | Email для восстановления |
| `getCode` | `(info: {blockingDuration, codeLength}) => Promise<string>` | Колбэк ввода кода из email |

Внутри последовательно вызывает op 112 → 107 → 108 → 109 → 110 → 111.

#### `client.disable2faPassword(currentPassword): Promise<void>`
Отключить 2FA. Op 112 → 113 → 111 с `remove2fa:true`.

#### `client.verify2faPassword(password): Promise<string>`
Op 113. Подтвердить пароль mid-session (нужно перед некоторыми критическими настройками). Возвращает `trackId` который можно использовать с другими auth-ops.

<a id="refreshWebToken"></a>
### `client.refreshWebToken(): Promise<WebTokenResponse>`
Op 158. Обновить short-lived OK-graph token (живёт ~14 минут). Используйте до `token_refresh_ts`.

---

<a id="bots"></a>
## 🤖 Боты

<a id="botInfo"></a>
### `client.getBotInfo(botId): Promise<unknown>`
Op 145. Метаданные бота (описание, аватар, BotFather-flags).

### `client.getBotCommands(botId, chatId?): Promise<unknown>`
Op 144. Список `/`-команд бота.

### `client.openBotMiniApp(botId, chatId): Promise<BotMiniAppOpenResponse>`
Op 160. Получить URL + signed `initData` для WebApp.

### `client.getComplainReasons(complainSync?): Promise<ComplainsSyncResponse>`
Op 162. Локализованные категории жалоб.

---

<a id="stickers"></a>
## 🎨 Стикеры

```ts
await client.favoriteStickerPack(packId);     // op 29 ASSETS_ADD
await client.unfavoriteStickerPack(packId);
```

---

<a id="drafts"></a>
## 📝 Черновики

```ts
await client.saveDraft(chatId, 'недописанный текст');  // op 176
await client.discardDraft(chatId);                      // op 177
```

---

<a id="lowLevel"></a>
## ⚙️ Низкоуровневое

<a id="raw"></a>
### `client.raw<T>(opcode, payload?): Promise<T>`
**Запасной выход.** Любой опкод (даже которого нет в высокоуровневом API) → ответ от сервера.

```ts
import { Opcode } from 'max-account-api';

// Resolve link БЕЗ вступления в чат:
const chat = await client.raw<{ chat: MaxChat }>(
  Opcode.CHAT_CHECK_LINK,
  { link: 'https://max.ru/somegroup' },
);
```

<a id="keepalive"></a>
### `client.keepalive(): Promise<{timestamp: number}>`
Op 1 (`PING`). Транспорт сам шлёт это каждые 30 секунд — ручной вызов нужен только для измерения round-trip.

<a id="logEvents"></a>
### `client.logEvents(events: EventLogItem[]): void`
Fire-and-forget отправка analytics-событий (op 5). Сервер не отвечает.

---

<a id="events"></a>
## 📡 События `client.on('event', handler)`

| Событие | Payload | Опкод-источник | Описание |
|---|---|---|---|
| `qr` | `{link: string, expiresAt: number}` | 288 `QR_START` | QR готов (только если `start()` запустил QR-flow) |
| `login` | `ContactInfo` | 291 `QR_LOGIN` | После успешного QR-логина (до полного `LOGIN`) |
| `ready` | — | — | После op 19 LOGIN — `getMe()` и `getChats()` доступны |
| `message` | `IncomingMessage` | 128 `NOTIF_MESSAGE` | Входящее сообщение (с авто-ack). Правки и удаления "для всех" прилетают **сюда же** ре-броадкастом — отличаются по `m.raw.status` (`'EDITED'` / `'REMOVED'`). Чтобы пропускать их: `if (m.raw.status) return;` |
| `chatUpdate` | `MaxChat` | 135 `NOTIF_CHAT` | Чат изменился (название, аватар, участники, …) |
| `readByOther` | `ReadMarkNotify` | 130 `NOTIF_MARK` | Кто-то прочитал вашу отправку |
| `presence` | `PresencePush` | 132 `NOTIF_PRESENCE` | Online/offline у контакта |
| `contactUpdate` | `ContactInfo` | 159 `NOTIF_PROFILE` | Контакт обновил профиль |
| `memberLeave` | `MemberLeavePush` | 129 | Service-push от участника группы |
| `stickerRecentsUpdate` | `StickerRecentsPush` | 150 `NOTIF_ASSETS_UPDATE` | Обновился список недавних стикеров |
| `fileUploadDone` | `FileUploadDonePush` | 136 `NOTIF_ATTACH` | Файл загружен на сервер (для `uploadFileBytes`) |
| `configChanged` | `string (hash)` | 134 `NOTIF_CONFIG` | Серверная конфигурация изменилась |
| `raw` | `WireFrame` | — | Любой WS-фрейм (отладка) |
| `reconnect` | `number (attempt)` | — | Транспорт планирует переподключение |
| `close` | `(code, reason)` | — | Сокет закрыт |
| `error` | `Error` | — | Неожиданная ошибка (parse / connection) |

---

<a id="types"></a>
## 🏷️ Ключевые типы

Полные определения — `src/types.ts`. Самые важные:

```ts
interface ContactInfo {
  id: number;
  registrationTime: number;
  accountStatus: number;
  names: Array<{ name: string; firstName?: string; lastName?: string; type: 'ONEME' | 'CUSTOM' }>;
  phone?: number;
  description?: string;
  photoId?: number;
  baseUrl?: string;     // i.oneme.ru avatar URL
  options?: string[];   // ['ONEME', 'TT', 'BOT', 'OFFICIAL', ...]
  updateTime: number;
}

interface MaxChat {
  id: number;
  type: 'DIALOG' | 'CHAT' | 'CHANNEL';
  status?: 'ACTIVE' | 'REMOVED';
  owner?: number;
  participants?: Record<string, number>;
  lastMessage?: MaxMessage;
  modified?: number;
  lastEventTime?: number;
  // … много опциональных полей
}

interface MaxMessage {
  id: string;
  sender: number;
  time: number;
  text?: string;
  type: 'USER' | 'SYSTEM' | 'CONTROL';
  elements?: MessageElement[];   // форматирование
  attaches?: MessageAttach[];    // вложения
  options?: number;
  link?: { type: 'REPLY' | 'FORWARD'; messageId?: string; chatId?: number };
  reactionInfo?: ReactionInfo;
  status?: MessageStatus;        // 'EDITED' | 'REMOVED' | (любая строка) — есть
                                 // только у ре-броадкаста (правка / удаление)
  updateTime?: number;           // ms-время последней правки, вместе со status
}

// 'EDITED' | 'REMOVED' | (string & {}) — набор открыт (см. src/types.ts)
type MessageStatus = 'EDITED' | 'REMOVED' | (string & {});

interface IncomingMessage {
  chatId: number;
  messageId: string;
  text: string;
  fromId: number;
  time: number;
  raw: MaxMessage;       // полная серверная копия
}

// Attaches:
interface PhotoAttach    { _type: 'PHOTO';    photoToken: string }
interface FileAttach     { _type: 'FILE';     fileId: number | string }
interface AudioAttach    { _type: 'AUDIO';    token: string; duration: number /* ms */; wave?: Uint8Array }
interface VideoAttach    { _type: 'VIDEO';    token: string; videoType?: number /* 1=circular note */; thumbhash?: Uint8Array }
interface StickerAttach  { _type: 'STICKER';  stickerId: number | string }
interface ContactAttach  { _type: 'CONTACT';  contactId: number }
interface LocationAttach { _type: 'LOCATION'; latitude: number; longitude: number; name?: string; address?: string }
interface PollAttach     { _type: 'POLL';     title: string; answers: Array<{text: string}>; settings: number }

interface PasswordChallenge {
  config: { passMaxLen: number; passMinLen: number; hintMaxLen: number };
  trackId: string;
  email: string;        // masked
  hint?: string;
}
```

---

<a id="exports"></a>
## Низкоуровневые экспорты

Для случаев когда нужен прямой контроль:

| Экспорт | Что это |
|---|---|
| `Transport` | WS-транспорт без MaxClient. `new Transport({url, headers}).connect()` + `.request(opcode, payload)`. |
| `RawTransport` | TLS+бинарный mobile-транспорт. Использует `hello()`, `confirmQrAuth()`, `mobileLogin()`. |
| `qrBindWebSession(raw, opts)` | Headless QR-bind при наличии mobile-сессии. Возвращает `webToken`. |
| `sendPhoneAuthCode(raw, phone)` / `verifyPhoneAuthCode(raw, code, token)` | Phone-auth ops 17 / 18 напрямую. |
| `hello(transport, deviceId, ua)` | Op 6 на WS. |
| `loginViaQr(transport, emitter)` | QR-loop (op 288 → 289 → 291). |
| `loginWithToken(transport, token, opts?)` | Op 19. |
| `FileSessionStore`, `MemorySessionStore` | Реализации `SessionStore`. |
| `Opcode`, `Cmd`, `PROTOCOL_VERSION` | Константы (см. `src/opcodes.ts`). |
| `uploadPhoto`, `uploadFile`, `downloadFile`, `firstPhotoToken` | Прямые HTTPS-helper'ы без `MaxClient`. |
