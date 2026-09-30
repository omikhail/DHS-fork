# @mikhail/dsh-telegram-voice

Voice-to-Text (STT) провайдер для `@ashafizullah/dsh-telegram`.

Превращает голосовые сообщения в Telegram-боте в текст через локальный Whisper ASR-сервис. Текст передаётся агенту как промт с префиксом `🎤`.

## Архитектура

```
Голосовое (OGG/Opus)
  → Telegram Bot API (getFile + downloadFile)
  → Whisper ASR (POST http://localhost:9000/asr)
  → Транскрипция
  → Агент получает "🎤 расшифрованный текст"
```

Плагин регистрирует Cordis-сервис `telegramStt` через `ctx.provide()`. Патч к `dsh-telegram` заставляет `MediaCollector` использовать этот сервис для голосовых сообщений.

## Установка

### 1. Зависимость в профиле

`~/.dsh/profiles/web/package.json`:

```json
{
  "dependencies": {
    "@mikhail/dsh-telegram-voice": "file:/home/mikhail/Projects/ИИ Агенты 🧠/DHS-plugins/dsh-telegram-voice-patch/plugin"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@morlay/dsh-llm-openai-compatible",
        "@mikhail/dsh-telegram-voice",
        "@ashafizullah/dsh-telegram"
      ]
    }
  }
}
```

> **Важно:** `@mikhail/dsh-telegram-voice` должен быть **перед** `@ashafizullah/dsh-telegram` в `bundles`. Иначе `ctx.get('telegramStt')` в dsh-telegram вернёт `undefined` — сервис ещё не зарегистрирован.

### 2. Конфиг в cordis.patch.yml

`~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- id: telegram-voice
  name: '@mikhail/dsh-telegram-voice'
  config:
    baseURL: http://localhost:9000
    language: ru
    timeoutMs: 30000
```

### 3. pnpm install

```bash
cd ~/.dsh/profiles/web
pnpm install
```

### 4. Патч к dsh-telegram

Патч уже зафиксирован через `pnpm patch` в `~/.dsh/profiles/web/patches/@ashafizullah__dsh-telegram@0.5.1.patch`. Он включает:

- **`lib/media/intake.js`** — `message.voice` и `message.audio`: `kind: 'unsupported'` → `kind: 'voice'`
- **`lib/media/collect.js`** — метод `transcribeVoice()`: скачивает OGG → отправляет в `stt.transcribe()` → возвращает текст с `🎤` префиксом. Fallback на заглушку если STT недоступен.
- **`lib/index.js`** — `ctx.get('telegramStt')` → передаёт в `MediaCollector` как `options.stt`

## Конфигурация

| Параметр | Default | Описание |
|----------|---------|----------|
| `baseURL` | `http://localhost:9000` | URL Whisper ASR-сервиса |
| `language` | `ru` | Код языка для транскрипции (пусто = авто-определение) |
| `timeoutMs` | `30000` | Таймаут запроса к Whisper в миллисекундах |

## Whisper ASR

Используется Docker-контейнер `onerahmet/openai-whisper-asr-webservice`:

```bash
docker run -d --name whisper-asr -p 9000:9000 \
  -e ASR_MODEL=small \
  onerahmet/openai-whisper-asr-webservice:latest
```

API: `POST /asr` (multipart/form-data, поле `audio_file`). Принимает OGG/Opus напрямую через внутренний FFmpeg — конверсия не нужна.

## Fallback

Три уровня при недоступности:

1. **Плагин не загружен** → `stt === undefined` → старая заглушка "I can't read a voice note"
2. **Whisper недоступен** → `stt.available() === false` → "⚠️ Расшифровка голоса недоступна"
3. **Ошибка транскрипции** → catch → "⚠️ Не удалось расшифровать голосовое"

## Структура

```
plugin/
├── package.json           # @mikhail/dsh-telegram-voice, Cordis plugin
├── cordis.patch.yml       # дефолтный конфиг (insert в composition tree)
└── lib/
    ├── index.js           # apply(): ctx.provide('telegramStt', { transcribe, available })
    ├── whisper-client.js  # WhisperClient: HTTP POST /asr, timeout, available()
    └── config.js          # Cordis Schema: baseURL, language, timeoutMs
```

## Сервисный контракт `telegramStt`

```typescript
interface TelegramStt {
  /** Доступен ли STT (Whisper отвечает) */
  available(): Promise<boolean>;
  /** Расшифровать аудио. Бросает Error при неудаче. */
  transcribe(audio: Uint8Array, opts?: {
    mimeType?: string;    // 'audio/ogg'
    language?: string;    // 'ru'
    signal?: AbortSignal;
  }): Promise<string>;
}
```

## Перезагрузка

```bash
systemctl --user restart deepseek-harness.service
```