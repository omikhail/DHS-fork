# @mikhail/dsh-web-search-ollama

Ollama Cloud web search провайдер для DSH. Регистрируется в `ctx.web` через `registerSearchProvider()`. Использует `POST https://ollama.com/api/web_search` с Bearer-токеном.

## Установка

### 1. Зависимость в профиле

`~/.dsh/profiles/web/package.json`:

```json
{
  "dependencies": {
    "@mikhail/dsh-web-search-ollama": "file:/home/mikhail/Projects/ИИ Агенты 🧠/DHS-plugins/dsh-web-search-ollama/plugin"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@mikhail/dsh-web-search-ollama",
        ...
      ]
    }
  }
}
```

> `@mikhail/dsh-web-search-ollama` грузится **после** `@deepseek-ai/dsh-web-app` (который владеет `ctx.web`).

### 2. Конфиг в cordis.patch.yml

```yaml
- id: web-search-ollama
  name: '@mikhail/dsh-web-search-ollama'
  config:
    apiKeyEnv: OLLAMA_API_KEY

- id: web
  config:
    searchProvider: ollama
```

### 3. API-ключ

Ключ Ollama в `~/.dsh/.env`:

```
OLLAMA_API_KEY=your_key_here
```

Создать ключ: https://ollama.com/settings/keys

### 4. Установка

```bash
cd ~/.dsh/profiles/web
pnpm install
systemctl --user restart deepseek-harness.service
```

## Конфигурация

| Параметр | Default | Описание |
|----------|---------|----------|
| `apiKey` | — | Литеральный API-ключ (prefer `apiKeyEnv`) |
| `apiKeyEnv` | `OLLAMA_API_KEY` | Имя env-переменной для ключа |
| `baseURL` | `https://ollama.com` | Базовый URL API |
| `numResults` | (unset) | Количество результатов по умолчанию (макс 10) |

## API

Ollama Cloud: `POST /api/web_search`

```json
// Request
{ "query": "what is node.js", "max_results": 5 }

// Response
{ "results": [{ "title": "...", "url": "...", "content": "..." }] }
```

Маппинг:
- `url` → `WebSearchSource.url`
- `title` → `WebSearchSource.title`
- `content` → `WebSearchSource.snippet`
- `publishedAt` — отсутствует (Ollama не предоставляет)
- `content` (generated answer) — отсутствует (только сниппеты)

## Структура

```
plugin/
├── package.json
├── cordis.patch.yml
└── lib/
    ├── index.js       # apply(): ctx.web.registerSearchProvider()
    ├── provider.js    # OllamaSearchProvider: available() + search()
    └── types.js       # JSDoc wire types
```

## Fallback

Если ключ пустой → `available()` возвращает `false` → seam использует другой провайдер или возвращает `WEB_PROVIDER_UNAVAILABLE`.