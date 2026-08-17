# FX Multi

Currency converter: one amount in several currencies at once. A static web app with no sign-up and no build step.

## Features

- Convert into several target currencies at once (fiat and crypto)
- Top 200 cryptocurrencies by market cap (CoinGecko)
- List settings: Fiat / Crypto tabs, search, drag-and-drop order
- Change the base currency and quick swap
- Themes: system, light, dark
- Russian and English UI
- Rate cache in `localStorage` (6-hour TTL) and manual refresh
- PWA: `manifest.webmanifest` and service worker
- Copy a result to the clipboard

## Stack

HTML, CSS, vanilla JS (ES modules). Fiat rates — [Open Exchange Rate API](https://open.er-api.com); crypto — [CoinGecko](https://www.coingecko.com/en/api) (`js/api.js`). No bundler required.

## Run

A local server is required because of ES modules and the service worker:

```bash
npm run serve
```

Conversion and cache tests:

```bash
npm test
```

## Structure

```
index.html
css/styles.css
js/
  app.js       # UI and app logic
  api.js       # rates and conversion
  i18n.js      # localization
  storage.js   # localStorage
  theme.js     # theme
sw.js
manifest.webmanifest
tests/api.test.js
```
