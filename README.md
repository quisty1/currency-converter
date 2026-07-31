# FX Multi

Конвертер валют: одна сумма сразу в нескольких валютах. Статическое веб-приложение без регистрации и без сборки.

## Возможности

- Конвертация в несколько целевых валют одновременно
- Настройка списка валют: поиск, выбор, порядок через drag-and-drop
- Смена базовой валюты и быстрый swap
- Темы: системная, светлая, тёмная
- Интерфейс на русском и английском
- Кэш курсов в `localStorage` (TTL 6 часов) и ручное обновление
- PWA: `manifest.webmanifest` и service worker
- Копирование результата в буфер обмена

## Стек

HTML, CSS, vanilla JS (ES modules). Курсы с [Open Exchange Rate API](https://open.er-api.com) (`js/api.js`). Сборщик не нужен.

## Запуск

Локальный сервер нужен из‑за ES modules и service worker:

```bash
npm run serve
```

Тесты конвертации и кэша:

```bash
npm test
```

## Структура

```
index.html
css/styles.css
js/
  app.js       # UI и логика приложения
  api.js       # курсы и конвертация
  i18n.js      # локализация
  storage.js   # localStorage
  theme.js     # тема
sw.js
manifest.webmanifest
tests/api.test.js
```
