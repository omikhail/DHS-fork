# max-account-api

[![npm](https://img.shields.io/npm/v/max-account-api)](https://www.npmjs.com/package/max-account-api)
[![license: MIT](https://img.shields.io/npm/l/max-account-api)](./LICENSE)
[![node](https://img.shields.io/node/v/max-account-api)](https://www.npmjs.com/package/max-account-api)

> ⚠️ **Неофициальная библиотека.** Не аффилирована с MAX / VK. Используйте на свой страх и риск — ваш аккаунт может быть помечен или заблокирован за нестандартную активность.

Node.js-клиент для **личного** MAX-аккаунта — залогиньтесь по номеру телефона или QR-коду и автоматизируйте всё что делает обычный пользователь: получать сообщения, отвечать, читать, реагировать, редактировать, отправлять фото / файлы / стикеры / опросы, создавать группы, и т.д.

Сложные части (TLS + msgpack + LZ4 бинарный протокол для phone-auth, WebSocket для всего остального, корреляция фреймов, ping / heartbeat, авто-реконнект, ack серверных push-ев) спрятаны за маленьким event-driven API.

```ts
import { MaxClient } from 'max-account-api';

const client = await MaxClient.loginWithPhone({
  phone: '+79991234567',
  getSmsCode: async () => prompt('SMS code: '),
});

client.on('message', (m) => console.log(`[${m.chatId}] ${m.fromId}: ${m.text}`));
await client.sendMessage(0, 'Привет в Избранное!');
```

## Возможности

| | |
|---|---|
| 📱 **Phone-auth + auto QR-bind** | Один метод `loginWithPhone({phone, getSmsCode, getPassword?})` — SMS-код, опционально облачный пароль (2FA), под капотом mobile binary protocol + WS QR-bind. Web-токен сохраняется автоматически. |
| 📷 **QR-логин** (как раньше) | Терминал-QR + событие со ссылкой. Старый flow `new MaxClient().start()` тоже работает. |
| 💾 **Гибкая сессия** | По умолчанию — `./.max-session.json`. Можно отдать кастомный `SessionStore` или инжектить `deviceId`+`loginToken` из env. |
| 🧩 **Несколько инстансов в процессе** | Каждый со своим store / тoken pair'ом. |
| 📨 **Сообщения** | Текст, реплаи, форварды, цитаты, редактирование, удаление, реакции, голосование в опросах. |
| 📎 **Вложения** | Фото, файлы, видео, стикеры, контакты, опросы — с end-to-end upload. |
| 👥 **Чаты / группы** | Создание групп / каналов, добавление / удаление / промоут участников, переименование, аватары, инвайт-линки, mute / unmute, pin, политика реакций. |
| 📞 **Звонки** | Signalling для 1:1 audio / video (медиа через отдельный `videowebrtc.okcdn.ru`). |
| 🔁 **Auto-reconnect** | Тихий повторный handshake при обрыве. |
| 📡 **Server push** | Подтверждается автоматически — вы получаете `'message'`, `'chatUpdate'`, `'presence'`, `'readByOther'`, и т.д. |
| 🔐 **Управление сессией** | Список активных сессий, logout, 2FA включить / выключить, смена пароля. |
| 📚 **Полная TypeScript-типизация** | На каждый запрос и ответ. 160+ опкодов с каноническими именами, извлечёнными из декомпилированного MAX-клиента. |
| 🪟 **Запасной выход** | `client.raw(opcode, payload)` для любого опкода которого нет в high-level API. |

## Установка

```bash
npm install max-account-api
```

Требуется Node.js 18+.

## Быстрый старт

### Вход по номеру телефона (рекомендуется)

```ts
import { MaxClient } from 'max-account-api';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });

const client = await MaxClient.loginWithPhone({
  phone: await rl.question('Phone (+79991234567): '),
  getSmsCode: () => rl.question('SMS code: '),
  // Опционально: вызовется только если у аккаунта 2FA облачный пароль
  getPassword: (challenge) =>
    rl.question(`2FA password (hint: ${challenge.hint}): `),
  sessionFile: './.max-session.json',
});

console.log('Logged in as', client.getMe()?.names?.[0]?.name);

client.on('message', async (m) => {
  if (m.fromId !== client.getMe()?.id) {
    await client.reply(m, `Эхо: ${m.text}`);
  }
});

rl.close();
// keep process alive
await new Promise(() => {});
```

На первом запуске MAX пришлёт SMS, после ввода кода + (если есть) 2FA пароля библиотека сохранит **оба** токена (mobile + web) в session-файл. На последующих запусках — тихий reconnect, ничего вводить не надо.

> **Регион:** SMS-доставка и phone-auth заблокированы серверной геолокацией. Запускайте из РФ или через VPN с RU-IP, иначе получите `service.unavailable` / `phone.region.unsupported`.

### Вход по QR-коду (без номера)

```ts
const client = new MaxClient();
client.on('qr', ({ link, expiresAt }) => {
  console.log('Откройте/отсканируйте:', link);
  console.log('Истекает в', new Date(expiresAt).toLocaleString());
});
await client.start();
```

QR печатается в терминал автоматически. После сканирования мобильным MAX в консоль выводятся `deviceId` + `loginToken` — сохраните их в env.

### Переиспользование токена (silent login)

```ts
const client = new MaxClient({
  deviceId:   process.env.MAX_DEVICE_ID,
  loginToken: process.env.MAX_LOGIN_TOKEN,
});
await client.start();
```

Если оба значения корректны — никакого QR / SMS не будет.

### Несколько инстансов в одном процессе

```ts
const a = new MaxClient({ deviceId: process.env.A_ID, loginToken: process.env.A_TOK });
const b = new MaxClient({ deviceId: process.env.B_ID, loginToken: process.env.B_TOK });
await Promise.all([a.start(), b.start()]);
```

## API по разделам

Полный справочник: [`docs/API.md`](docs/API.md). Основные группы:

### Сообщения

```ts
await client.sendMessage(chatId, 'привет');
await client.sendReply(chatId, replyToMessageId, 'ответ на сообщение');
await client.reply(incoming, 'эхо');                   // ответить на полученное
await client.editMessage(chatId, msgId, 'новый текст');
await client.deleteMessages(chatId, [msgId1, msgId2], /*forAll*/ true);
await client.forwardMessage(toChatId, fromChatId, msgId, 'опциональный комментарий');
await client.sendTyping(chatId);
await client.readMessage(chatId, msgId);
await client.getHistory(chatId, { backward: 50 });
await client.searchMessages(chatId, 'query');
```

### Реакции

```ts
await client.setReaction(chatId, msgId, '👍');
await client.removeReaction(chatId, msgId);
const reactions = await client.getReactions(chatId, [msgId1, msgId2]);
```

### Вложения

```ts
const photoToken = await client.uploadPhotoBytes({ data: pngBytes, filename: 'pic.png' });
await client.sendPhoto(chatId, photoToken, 'подпись');

const file = await client.uploadFileBytes({ data: pdfBytes, filename: 'doc.pdf' });
await client.sendFile(chatId, file.fileId, 'договор');

await client.sendVoice(chatId, { data: oggBytes, filename: 'voice.ogg' }, { duration: 12 });
await client.sendVideo(chatId, { data: mp4Bytes, filename: 'clip.mp4' }, 'смотри ролик');
await client.sendVideoNote(chatId, { data: mp4Bytes });  // круглый кружок

await client.sendSticker(chatId, stickerId);
await client.sendContact(chatId, contactId);
await client.sendLocation(chatId, 55.7558, 37.6173, { name: 'Кремль' });
await client.sendPoll(chatId, 'Куда едем?', ['Сочи', 'Питер', 'Казань']);
```

> `sendVoice` / `sendVideo` / `sendVideoNote` требуют `mobileLoginToken` (т.е. сессию, заведённую через `MaxClient.loginWithPhone()`); через QR-only login они недоступны.

### Группы / каналы

```ts
const group = await client.createGroup('Тестовая группа', [userId1, userId2]);
await client.addGroupParticipants(group.chatId, [userId3]);
await client.setGroupAdmin(group.chatId, userId1);
await client.renameGroup(group.chatId, 'Новое имя');
await client.setChatAvatar(group.chatId, photoToken);
await client.pinMessage(group.chatId, msgId);
await client.leaveChat(group.chatId);
await client.resolveChatLink('https://max.ru/somegroup');  // op 57 — фактически вступает в чат
```

### Чаты

```ts
const chats = client.getChats();                       // снимок при логине
const fresh = await client.getChatsByIds([id1, id2]);
await client.muteChat(chatId, /*muteUntilMs*/ -1);
await client.unmuteChat(chatId);
await client.clearChatHistory(chatId);                 // только история
await client.deleteChat(chatId);                       // полностью удалить
await client.subscribeChat(chatId, true);
```

### Контакты

```ts
const me = client.getMe();
const c = await client.getContactInfo(userId);
await client.addContactByPhone('+79991234567', 'Имя', 'Фамилия');
await client.lookupContactByPhone('+79991234567');     // без сохранения
await client.renameContact(userId, 'Новое имя');
await client.blockContact(userId);
await client.unblockContact(userId);
await client.removeContact(userId);
const blocked = await client.listBlockedContacts();
const presence = await client.getPresence([userId]);
```

### Профиль

```ts
await client.setProfileName('Имя', 'Фамилия');
await client.setProfileDescription('обо мне');
await client.setProfileAvatar(photoToken);
await client.updateProfile({ firstName: 'Имя', description: 'обо мне' });
```

### Сессии / безопасность

```ts
const sessions = await client.listSessions();
await client.logout();                                 // op 20 + локально стереть токен
await client.enable2faPassword({
  password: 'NewSecurePass123',
  hint: 'мамин день рождения',
  recoveryEmail: 'me@example.com',
  getCode: async ({ codeLength }) => prompt(`Code from email (${codeLength}): `),
});
await client.disable2faPassword(currentPassword);
```

### Папки

```ts
const folders = await client.getFolders(['folder-id-1']);
await client.upsertFolder({ title: 'Боты', filters: [10], /* ... */ });
await client.reorderFolders(['id1', 'id2', 'id3']);
```

### Поиск

```ts
const result = await client.globalSearch('текст');
const channels = await client.globalSearchByType('канал', 'CHANNELS');
const inChat = await client.searchMessages(chatId, 'слово');
```

### Запасной выход

```ts
// Любой опкод которого нет в high-level API:
const res = await client.raw<MyResponse>(Opcode.SOME_OP, { /* payload */ });
```

## События

```ts
client.on('qr',                ({ link, expiresAt }) => …);  // QR готов
client.on('login',             (me) => …);                    // QR подтверждён, профиль есть
client.on('ready',             () => …);                      // полная инициализация
client.on('message',           (m) => …);                     // входящее сообщение
client.on('chatUpdate',        (chat) => …);                  // chat info изменился
client.on('readByOther',       (mark) => …);                  // кто-то прочитал твоё сообщение
client.on('presence',          (p) => …);                     // online/offline у контакта
client.on('contactUpdate',     (contact) => …);
client.on('memberLeave',       (notif) => …);
client.on('stickerRecentsUpdate', (push) => …);
client.on('fileUploadDone',    (push) => …);
client.on('configChanged',     (hash) => …);
client.on('raw',               (frame) => …);                 // любой WS-фрейм (отладка)
client.on('reconnect',         (attempt) => …);
client.on('close',             (code, reason) => …);
client.on('error',             (err) => …);
```

> **Правки и удаления приходят в `message`.** Когда сообщение редактируют или удаляют «для всех», сервер ре-броадкастит его тем же опкодом 128 — то есть оно снова прилетает в `client.on('message', …)`. Отличить такой ре-броадкаст от нового сообщения можно по `m.raw.status` (`'EDITED'` / `'REMOVED'`; у нового сообщения поля нет). Чтобы их игнорировать:
> ```ts
> client.on('message', (m) => {
>   if (m.raw.status) return;        // пропускаем правки / «надгробия» удалённых
>   // … обычная обработка нового сообщения
> });
> ```

## Документация

| Файл | Что внутри |
|---|---|
| [`docs/API.md`](docs/API.md) | Полный справочник по `MaxClient` (каждый метод + типы аргументов / возвращаемых значений) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Что реализовано, известные ограничения |

## Примеры

В [`examples/`](examples/) — десяток мини-сценариев (echo-бот, отправка фото / файла / голоса / видео-кружка / локации, реакции, опросы, группы, поиск, контакты, …):

```bash
npm run example:phone        # tsx examples/phone-bot.ts  — phone-login + echo
npm run example:echo         # tsx examples/echo-bot.ts   — QR-логин + echo
npx tsx examples/send-photo.ts ./pic.png 0
npx tsx examples/send-voice.ts ./voice.ogg 12 0
```

Подробнее — [`examples/README.md`](examples/README.md).

## Безопасность сессии

Файл `.max-session*.json` содержит **LOGIN-токен** — это эквивалент пароля от вашего MAX-аккаунта. Никогда не коммитьте, не передавайте в логи / Slack / GitHub Issues. В `.gitignore` уже добавлено правило `.max-session*.json`.

Если токен скомпрометирован — `await client.logout()` или войдите в **mobile MAX** → Настройки → Устройства → завершите сессию.

Для multi-tenant / production хранилищ реализуйте свой `SessionStore`:

```ts
import type { SessionStore, StoredSession } from 'max-account-api';

class VaultSessionStore implements SessionStore {
  async load(): Promise<StoredSession> { /* read from secrets vault */ }
  async save(s: StoredSession): Promise<void> { /* write back */ }
}

const client = new MaxClient({ session: new VaultSessionStore() });
```

## Что не покрыто / ограничения

- **Медиа звонков** (`videowebrtc.okcdn.ru/ws2`) — есть только signalling (`startCall`), сами RTP / WebRTC потоки вне scope библиотеки.
- **Live streams** — есть `chatLivestreamInfo` (op 62), но запуск стрима не реализован.
- **Mini-apps / WebView** — есть `openBotMiniApp` (op 160), сам WebApp / WebView пользователь рендерит сам.
- **SMS phone-auth** — заблокирован сервером для не-RU IP, нужен RU-IP или VPN.

Полная таблица — [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Дисклеймер

Это пользовательский эксперимент по реверс-инжинирингу. Протокол не публичный; опкоды наблюдены через официальный веб-клиент и Android-клиент (v26.15.1), могут быть изменены MAX без предупреждения. Автор не несёт ответственности за блокировку аккаунтов в результате использования библиотеки.

**Не используйте её для спама, скрейпинга, массовых рассылок или иных нарушений условий использования MAX.**

## Лицензия

MIT
