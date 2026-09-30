# Wikilinks в `doc/`

Между файлами внутри `doc/` используй Obsidian-формат:

- `[[repo/doc/<module>/...]]` — от корня репозитория через префикс `repo/doc/`.

Не используй markdown-ссылки вида `[text](other.md)` между doc-файлами, если в проекте принят wikilink-граф.

## Проверка ссылок

Если в репозитории есть `tools/obsidian_link_audit.py`:

```bash
python3 tools/obsidian_link_audit.py doc/ --follow-symlinks
```

Иначе — проверяй целевые пути вручную после переносов (`git mv`).
