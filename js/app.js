// точка входа UI: конвертация, управление списком валют,
// тема/локаль, URL sync, drag-reorder, PWA SW
import {
  convert,
  cryptoCodes,
  currencyCodesFromRates,
  fetchCryptoMarkets,
  fetchRates,
  fiatCodes,
  hasCryptoMeta,
  isCacheStale,
  isCurrencyCode,
  mergeRates,
  unitRate,
} from './api.js';
import { assetMarkup, assetUrl } from './flags.js';
import {
  currencyName,
  formatAmount,
  formatAmountNumber,
  formatRateDate,
  formatRateValue,
  t,
} from './i18n.js';
import { loadState, saveState } from './storage.js';
import { applyTheme, watchSystemTheme } from './theme.js';

// селектор фокусируемых элементов внутри manage-sheet (trap Tab)
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// кэш DOM-ссылок; i18n-элементы + интерактивные контролы
const els = {
  amountLabel: document.querySelector('[data-i18n="amountLabel"]'),
  baseLabel: document.querySelector('[data-i18n="baseLabel"]'),
  resultsTitle: document.querySelector('[data-i18n="resultsTitle"]'),
  manageTitle: document.querySelector('[data-i18n="manageTitle"]'),
  manageHint: document.querySelector('[data-i18n="manageHint"]'),
  openManage: document.querySelector('[data-i18n="openManage"]'),
  closeManage: document.querySelector('[data-i18n="closeManage"]'),
  searchCurrencies: document.querySelector('[data-i18n="searchCurrencies"]'),
  themeLabel: document.querySelector('[data-i18n="themeLabel"]'),
  langLabel: document.querySelector('[data-i18n="langLabel"]'),
  refreshRates: document.querySelector('[data-i18n="refreshRates"]'),
  swapCurrencies: document.querySelector('[data-i18n="swapCurrencies"]'),
  amount: document.getElementById('amount'),
  amountClear: document.getElementById('amount-clear'),
  base: document.getElementById('base'),
  baseFlag: document.getElementById('base-flag'),
  results: document.getElementById('results'),
  status: document.getElementById('status'),
  theme: document.getElementById('theme'),
  locale: document.getElementById('locale'),
  shell: document.querySelector('.shell'),
  managePanel: document.getElementById('manage-panel'),
  manageSheet: document.querySelector('.manage-sheet'),
  manageList: document.getElementById('manage-list'),
  manageSearch: document.getElementById('manage-search'),
  manageTabs: document.querySelector('.manage-tabs'),
  tabFiat: document.getElementById('tab-fiat'),
  tabCrypto: document.getElementById('tab-crypto'),
  openManageBtn: document.getElementById('open-manage'),
  closeManageBtn: document.getElementById('close-manage'),
  refreshBtn: document.getElementById('refresh-rates'),
  swapBtn: document.getElementById('swap-currencies'),
};

let state = loadState();
// актуальный payload курсов (живой или из кэша)
let ratesPayload = state.ratesCache;
// показали курсы из localStorage, сеть ещё не ответила / упала
let usingCache = false;
// кэш старше TTL
let cacheStale = false;
let loading = false;
// фильтр поиска в панели управления валютами
let manageQuery = '';
// вкладка модалки: фиат | крипто
let manageTab = 'fiat';
// AbortController текущего fetchRates
let ratesAbort = null;
// куда вернуть фокус после закрытия manage
let manageReturnFocus = null;
// таймер сброса текста «Скопировано»
let copyResetTimer = null;
// защита от цикла replaceState ↔ popstate-логики
let syncingUrl = false;
// состояние pointer-drag строки результатов
let resultsDrag = null;
// после drag не срабатывает copy по click
let suppressResultsCopy = false;

// px до начала reorder (отсекает клик)
const DRAG_THRESHOLD = 6;

function availableCodes() {
  return currencyCodesFromRates(ratesPayload || state.ratesCache);
}

function currentCryptoMeta() {
  return (ratesPayload || state.ratesCache)?.cryptoMeta || null;
}

function nameOf(code) {
  return currencyName(state.locale, code, currentCryptoMeta());
}

// сохраняет partial и синхронизирует query string
function persist(partial) {
  state = saveState(state, partial);
  syncUrlFromState();
  return state;
}

// нормализует ввод: пробелы, запятая → точка
function parseAmount(raw) {
  const normalized = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return NaN;
  return Number(normalized);
}

// пустое поле не ошибка; нечисло — ошибка
function amountIsInvalid() {
  const raw = String(els.amount.value).trim();
  if (!raw) return false;
  return !Number.isFinite(parseAmount(raw));
}

// крестик очистки суммы
function syncAmountClear() {
  if (!els.amountClear) return;
  els.amountClear.hidden = String(els.amount.value).length === 0;
}

// цели без базовой валюты (база не дублируется в списке результатов)
function visibleTargets() {
  return state.targets.filter((code) => code !== state.base);
}

function getFocusable(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

// абсолютные URL для OG/canonical/JSON-LD
function siteBaseUrl() {
  const path = window.location.pathname.replace(/index\.html$/i, '');
  const base = path.endsWith('/') ? path : `${path}/`;
  return `${window.location.origin}${base}`;
}

function syncSeoUrls() {
  const base = siteBaseUrl();
  const image = new URL('icons/icon-512.png', base).href;
  const canonical = document.getElementById('seo-canonical');
  const ogUrl = document.getElementById('seo-og-url');
  const ogImage = document.getElementById('seo-og-image');
  const twImage = document.getElementById('seo-twitter-image');
  if (canonical) canonical.href = base;
  if (ogUrl) ogUrl.setAttribute('content', base);
  if (ogImage) ogImage.setAttribute('content', image);
  if (twImage) twImage.setAttribute('content', image);

  const jsonLd = document.getElementById('seo-jsonld');
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd.textContent);
      data.url = base;
      data.image = image;
      data.description = t(state.locale, 'metaDescription');
      data.inLanguage = state.locale;
      jsonLd.textContent = JSON.stringify(data);
    } catch {
      // битый JSON-LD не трогаем
    }
  }
}

// индикаторы загрузки: refresh spinner, aria-busy, opacity списка
function setLoadingUi(isLoading) {
  loading = isLoading;
  els.refreshBtn.disabled = isLoading;
  els.refreshBtn.classList.toggle('is-busy', isLoading);
  els.refreshBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  const spin = els.refreshBtn.querySelector('.spinner');
  if (spin) spin.hidden = !isLoading;
  els.results.classList.toggle('is-loading', isLoading);
  els.results.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

// применяет ?amount&from&to&locale&theme к state при старте
function applyUrlToState() {
  const params = new URLSearchParams(window.location.search);
  const amount = params.get('amount');
  const from = params.get('from')?.toUpperCase();
  const to = params.get('to');
  const locale = params.get('locale');
  const theme = params.get('theme');

  const patch = {};

  if (amount != null && amount !== '') patch.amount = amount;
  if (from && isCurrencyCode(from)) patch.base = from;
  if (locale === 'ru' || locale === 'en') patch.locale = locale;
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    patch.theme = theme;
  }

  if (to) {
    const codes = to
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter((c) => isCurrencyCode(c));
    if (codes.length) {
      const base = patch.base || state.base;
      // база всегда в targets, даже если её не было в to=
      patch.targets = [...new Set([base, ...codes])];
    }
  }

  if (Object.keys(patch).length) {
    state = saveState(state, patch);
  }
}

// пишет текущий state в URL без добавления истории
function syncUrlFromState() {
  if (syncingUrl) return;
  const params = new URLSearchParams();
  params.set('amount', state.amount);
  params.set('from', state.base);
  const targets = visibleTargets();
  if (targets.length) params.set('to', targets.join(','));
  params.set('locale', state.locale);
  if (state.theme !== 'system') params.set('theme', state.theme);

  const next = `${window.location.pathname}?${params.toString()}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (next !== current) {
    syncingUrl = true;
    history.replaceState(null, '', next);
    syncingUrl = false;
  }
}

// проставляет тексты/aria/placeholder по data-i18n* и опции темы
function renderI18n() {
  const locale = state.locale;
  document.documentElement.lang = locale;
  document.title = `${t(locale, 'appName')} — ${t(locale, 'tagline')}`;

  const description = t(locale, 'metaDescription');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', description);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', description);
  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', description);
  const ogLocale = document.getElementById('seo-og-locale');
  if (ogLocale) {
    ogLocale.setAttribute('content', locale === 'ru' ? 'ru_RU' : 'en_US');
  }
  const ogAlt = document.querySelector('meta[property="og:locale:alternate"]');
  if (ogAlt) {
    ogAlt.setAttribute('content', locale === 'ru' ? 'en_US' : 'ru_RU');
  }

  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(locale, el.dataset.i18n);
  }

  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(locale, el.dataset.i18nPlaceholder);
  }

  for (const el of document.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(locale, el.dataset.i18nAria));
  }

  for (const option of els.theme.options) {
    option.textContent = t(
      locale,
      {
        light: 'themeLight',
        dark: 'themeDark',
        system: 'themeSystem',
      }[option.value],
    );
  }

  syncSeoUrls();
}

// заполняет <select#base> optgroup фиат / крипто
function fillBaseSelect() {
  const previous = state.base;
  const payload = ratesPayload || state.ratesCache;
  let fiat = fiatCodes(payload);
  let crypto = cryptoCodes(payload);

  if (previous && !fiat.includes(previous) && !crypto.includes(previous)) {
    // неизвестный код из state — в группу фиата
    fiat = [...fiat, previous].sort();
  }

  const fiatOpts = fiat
    .map((code) => {
      const label = `${code} — ${nameOf(code)}`;
      return `<option value="${code}">${label}</option>`;
    })
    .join('');
  const cryptoOpts = crypto
    .map((code) => {
      const label = `${code} — ${nameOf(code)}`;
      return `<option value="${code}">${label}</option>`;
    })
    .join('');

  const parts = [];
  if (fiatOpts) {
    parts.push(
      `<optgroup label="${t(state.locale, 'groupFiat')}">${fiatOpts}</optgroup>`,
    );
  }
  if (cryptoOpts) {
    parts.push(
      `<optgroup label="${t(state.locale, 'groupCrypto')}">${cryptoOpts}</optgroup>`,
    );
  }
  els.base.innerHTML = parts.join('');

  const all = [...fiat, ...crypto];
  els.base.value = all.includes(previous) ? previous : all[0] || 'USD';
  syncBaseFlag();
}

// картинка флага/иконки рядом с select базы
function syncBaseFlag() {
  if (!els.baseFlag) return;
  const code = els.base.value || state.base;
  const meta = currentCryptoMeta();
  const src = assetUrl(code, meta);
  const isCrypto = Boolean(meta?.[String(code).toUpperCase()]?.image);

  els.baseFlag.classList.toggle('flag', !isCrypto);
  els.baseFlag.classList.toggle('asset-icon', isCrypto);

  if (!src) {
    els.baseFlag.hidden = true;
    els.baseFlag.replaceChildren();
    return;
  }
  els.baseFlag.hidden = false;
  let img = els.baseFlag.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      els.baseFlag.hidden = true;
    });
    els.baseFlag.appendChild(img);
  }
  img.width = isCrypto ? 20 : 20;
  img.height = isCrypto ? 20 : 15;
  if (img.getAttribute('src') !== src) img.src = src;
}

function syncManageTabs() {
  const isFiat = manageTab === 'fiat';
  if (els.tabFiat) {
    els.tabFiat.setAttribute('aria-selected', isFiat ? 'true' : 'false');
  }
  if (els.tabCrypto) {
    els.tabCrypto.setAttribute('aria-selected', isFiat ? 'false' : 'true');
  }
  if (els.manageList) {
    els.manageList.setAttribute(
      'aria-labelledby',
      isFiat ? 'tab-fiat' : 'tab-crypto',
    );
  }
}

// чекбоксы + стрелки порядка в панели manage (по вкладке)
function renderManageList() {
  syncManageTabs();
  const selected = new Set(state.targets);
  const query = manageQuery.trim().toLowerCase();
  const payload = ratesPayload || state.ratesCache;
  const tabCodes =
    manageTab === 'crypto' ? cryptoCodes(payload) : fiatCodes(payload);
  const meta = currentCryptoMeta();

  const codes = tabCodes.filter((code) => {
    if (!query) return true;
    const name = nameOf(code).toLowerCase();
    return code.toLowerCase().includes(query) || name.includes(query);
  });

  if (!codes.length) {
    els.manageList.innerHTML = `<p class="manage-empty">${t(state.locale, 'searchEmpty')}</p>`;
    return;
  }

  const orderIndex = new Map(state.targets.map((c, i) => [c, i]));

  els.manageList.innerHTML = codes
    .map((code) => {
      const checked = selected.has(code);
      const disabled = code === state.base;
      const name = nameOf(code);
      const canMove = checked && !disabled && orderIndex.has(code);
      const selectedOrdered = state.targets.filter((c) => c !== state.base);
      const pos = selectedOrdered.indexOf(code);
      const isFirst = canMove && pos === 0;
      const isLast = canMove && pos === selectedOrdered.length - 1;

      return `
      <div class="manage-item ${disabled ? 'is-disabled' : ''}">
        <label class="manage-item-main">
          <input type="checkbox" value="${code}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
          ${assetMarkup(code, meta)}
          <span class="manage-code">${code}</span>
          <span class="manage-name">${name}</span>
        </label>
        ${
          canMove
            ? `<div class="manage-order">
          <button type="button" class="btn-icon" data-move="up" data-code="${code}" ${isFirst ? 'disabled' : ''} aria-label="${t(state.locale, 'moveUp')}">↑</button>
          <button type="button" class="btn-icon" data-move="down" data-code="${code}" ${isLast ? 'disabled' : ''} aria-label="${t(state.locale, 'moveDown')}">↓</button>
        </div>`
            : ''
        }
      </div>
    `;
    })
    .join('');
}

// строки результатов: сумма, unit rate, drag-handle, copy
function renderResults() {
  const amount = parseAmount(els.amount.value);
  const targets = visibleTargets();
  const meta = currentCryptoMeta();
  els.results.classList.toggle('is-loading', loading);
  els.results.setAttribute('aria-busy', loading ? 'true' : 'false');

  if (!targets.length) {
    els.results.innerHTML = `<li class="result-empty">${t(state.locale, 'manageHint')}</li>`;
    return;
  }

  const canRemove = targets.length > 1;

  els.results.innerHTML = targets
    .map((code) => {
      const value = convert(amount, state.base, code, ratesPayload);
      const formatted = formatAmount(state.locale, value, code, meta);
      const copyValue = formatAmountNumber(state.locale, value, code, meta);
      const name = nameOf(code);
      const rate = unitRate(state.base, code, ratesPayload);
      const rateText =
        rate == null
          ? ''
          : t(state.locale, 'unitRate', {
              from: state.base,
              rate: formatRateValue(state.locale, rate, code, meta),
            });

      return `
      <li class="result-row" data-code="${code}" data-copy="${copyValue}">
        <button
          type="button"
          class="result-drag"
          data-drag-handle
          draggable="false"
          aria-label="${t(state.locale, 'dragHandle')}"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="5" cy="4" r="1.25" fill="currentColor" />
            <circle cx="11" cy="4" r="1.25" fill="currentColor" />
            <circle cx="5" cy="8" r="1.25" fill="currentColor" />
            <circle cx="11" cy="8" r="1.25" fill="currentColor" />
            <circle cx="5" cy="12" r="1.25" fill="currentColor" />
            <circle cx="11" cy="12" r="1.25" fill="currentColor" />
          </svg>
        </button>
        <div class="result-meta">
          <span class="result-heading">
            ${assetMarkup(code, meta)}
            <span class="result-code">${code}</span>
          </span>
          <span class="result-name">${name}</span>
          ${rateText ? `<span class="result-rate">${rateText}</span>` : ''}
        </div>
        <div class="result-aside">
          <div class="result-value">${formatted}</div>
          <button
            type="button"
            class="btn-text result-copy"
            data-copy-btn
            aria-label="${t(state.locale, 'copyAmount')}"
          >${t(state.locale, 'copyAmount')}</button>
        </div>
        <button
          type="button"
          class="result-remove"
          data-remove-btn
          aria-label="${t(state.locale, 'removeCurrency')}"
          ${canRemove ? '' : 'disabled'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3.5 3.5l7 7M10.5 3.5l-7 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </li>
    `;
    })
    .join('');
}

// статусная строка: ошибка суммы / loading / кэш / свежий курс
function renderStatus() {
  if (amountIsInvalid()) {
    els.status.textContent = t(state.locale, 'invalidAmount');
    els.status.dataset.tone = 'error';
    return;
  }

  if (loading) {
    els.status.innerHTML = `<span class="spinner spinner-inline" aria-hidden="true"></span><span>${t(state.locale, 'ratesLoading')}</span>`;
    els.status.dataset.tone = 'muted';
    return;
  }

  if (!ratesPayload) {
    els.status.textContent = t(state.locale, 'ratesError');
    els.status.dataset.tone = 'error';
    return;
  }

  const date = formatRateDate(state.locale, ratesPayload.date);
  if (usingCache || cacheStale) {
    els.status.textContent = t(
      state.locale,
      cacheStale && !usingCache ? 'ratesStale' : 'ratesCached',
      { date },
    );
    els.status.dataset.tone = 'warn';
    return;
  }

  els.status.textContent = t(state.locale, 'ratesUpdated', { date });
  els.status.dataset.tone = 'ok';
}

function renderAll() {
  renderI18n();
  fillBaseSelect();
  renderManageList();
  renderResults();
  renderStatus();
  syncAmountClear();
  els.refreshBtn.disabled = loading;
  els.swapBtn.disabled = visibleTargets().length === 0;
}

// загрузка курсов: фиат (USD) + крипта параллельно, merge
// свежий кэш — без сети; иначе stale-while-revalidate + force
async function loadRates(base = state.base, { force = false } = {}) {
  if (ratesAbort) ratesAbort.abort();
  ratesAbort = new AbortController();
  const { signal } = ratesAbort;
  const requestBase = base;

  const cached = state.ratesCache;
  const stale = isCacheStale(cached);

  // без cryptoMeta кэш неполный (старый фиат-only) — догружаем сеть
  if (!force && cached?.rates && !stale && hasCryptoMeta(cached)) {
    ratesPayload = cached;
    usingCache = false;
    cacheStale = false;
    setLoadingUi(false);
    fillBaseSelect();
    renderManageList();
    renderResults();
    renderStatus();
    return;
  }

  // сразу показываем кэш, пока идёт сеть
  if (cached?.rates) {
    ratesPayload = cached;
    usingCache = true;
    cacheStale = stale;
    fillBaseSelect();
    renderManageList();
    renderResults();
  }

  setLoadingUi(true);
  renderStatus();

  try {
    // фиат всегда от USD (API не принимает крипту как base)
    const [fiatResult, cryptoResult] = await Promise.allSettled([
      fetchRates('USD', { signal }),
      fetchCryptoMarkets({ signal }),
    ]);

    if (signal.aborted || requestBase !== state.base) return;

    const fiatPayload =
      fiatResult.status === 'fulfilled' ? fiatResult.value : null;
    const cryptoPayload =
      cryptoResult.status === 'fulfilled' ? cryptoResult.value : null;

    // при partial failure подмешиваем куски из кэша
    const fallbackFiat =
      fiatPayload ||
      (cached?.rates
        ? {
            base: cached.base || 'USD',
            date: cached.date,
            rates: Object.fromEntries(
              Object.entries(cached.rates).filter(
                ([code]) => !cached.cryptoMeta?.[code],
              ),
            ),
            fetchedAt: cached.fetchedAt,
          }
        : null);
    const fallbackCrypto =
      cryptoPayload ||
      (cached?.cryptoMeta
        ? {
            rates: Object.fromEntries(
              Object.entries(cached.rates || {}).filter(
                ([code]) => cached.cryptoMeta[code],
              ),
            ),
            meta: cached.cryptoMeta,
            fetchedAt: cached.fetchedAt,
          }
        : null);

    const payload = mergeRates(fallbackFiat, fallbackCrypto);
    if (!payload) throw new Error('no_rates');

    ratesPayload = payload;
    usingCache = !fiatPayload || !cryptoPayload;
    cacheStale = false;
    persist({ ratesCache: payload, base: requestBase });
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (state.ratesCache?.rates) {
      ratesPayload = state.ratesCache;
      usingCache = true;
      cacheStale = isCacheStale(state.ratesCache);
    } else {
      ratesPayload = null;
      usingCache = false;
      cacheStale = false;
    }
  } finally {
    if (!signal.aborted) {
      setLoadingUi(false);
      fillBaseSelect();
      renderManageList();
      renderResults();
      renderStatus();
    }
  }
}

function onAmountInput() {
  persist({ amount: els.amount.value });
  syncAmountClear();
  renderResults();
  renderStatus();
}

function onAmountClear() {
  els.amount.value = '';
  persist({ amount: '' });
  syncAmountClear();
  renderResults();
  renderStatus();
  els.amount.focus();
}

// смена базы: база в targets, fallback-цель, force reload
async function onBaseChange() {
  const base = els.base.value;
  syncBaseFlag();
  let targets = state.targets.includes(base)
    ? [...state.targets]
    : [...state.targets, base];

  const others = targets.filter((c) => c !== base);
  if (!others.length) {
    const fallback = availableCodes().find((c) => c !== base);
    if (fallback) targets.push(fallback);
  }

  persist({ base, targets });
  renderManageList();
  els.swapBtn.disabled = visibleTargets().length === 0;
  await loadRates(base, { force: true });
}

function onThemeChange() {
  const theme = els.theme.value;
  persist({ theme });
  applyTheme(theme);
}

function onLocaleChange() {
  persist({ locale: els.locale.value });
  renderAll();
}

// убрать валюту из списка; нельзя снять последнюю цель кроме базы
function removeTarget(code) {
  const targets = state.targets.filter((c) => c !== code);
  const others = targets.filter((c) => c !== state.base);
  if (!others.length) return false;

  persist({ targets });
  renderManageList();
  renderResults();
  els.swapBtn.disabled = visibleTargets().length === 0;
  return true;
}

// чекбокс валюты; нельзя снять последнюю цель кроме базы
function onManageChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;

  const code = input.value;

  if (input.checked) {
    let targets = [...state.targets];
    if (!targets.includes(code)) targets.push(code);
    persist({ targets });
    renderManageList();
    renderResults();
    els.swapBtn.disabled = visibleTargets().length === 0;
    return;
  }

  if (!removeTarget(code)) {
    input.checked = true;
  }
}

// переставляет visibleTargets; база остаётся в начале Set
function reorderTargets(fromIndex, toIndex) {
  const others = visibleTargets();
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= others.length ||
    toIndex >= others.length ||
    fromIndex === toIndex
  ) {
    return false;
  }

  const [item] = others.splice(fromIndex, 1);
  others.splice(toIndex, 0, item);
  persist({ targets: [...new Set([state.base, ...others])] });
  renderManageList();
  return true;
}

// порядок строк результатов из DOM → state.targets
function persistVisibleOrderFromDom() {
  const codes = [...els.results.querySelectorAll('.result-row')]
    .map((row) => row.dataset.code)
    .filter(Boolean);
  const current = visibleTargets();
  if (
    !codes.length ||
    codes.length !== current.length ||
    codes.every((code, i) => code === current[i])
  ) {
    return;
  }

  persist({ targets: [...new Set([state.base, ...codes])] });
  renderManageList();
}

function moveTarget(code, direction) {
  const others = visibleTargets();
  const index = others.indexOf(code);
  if (index < 0) return;

  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (reorderTargets(index, swapWith)) {
    renderResults();
  }
}

function endResultsDrag(event) {
  if (!resultsDrag || event.pointerId !== resultsDrag.pointerId) return;

  const { row, didDrag, handle } = resultsDrag;
  try {
    handle?.releasePointerCapture?.(event.pointerId);
  } catch {
    // уже отпущен
  }

  row.classList.remove('is-dragging');
  els.results.classList.remove('is-reordering');
  document.removeEventListener('pointermove', onResultsPointerMove);
  document.removeEventListener('pointerup', endResultsDrag);
  document.removeEventListener('pointercancel', endResultsDrag);
  resultsDrag = null;

  if (!didDrag) return;

  suppressResultsCopy = true;
  persistVisibleOrderFromDom();
}

function onResultsPointerDown(event) {
  if (event.button !== 0) return;
  const handle = event.target.closest('[data-drag-handle]');
  if (!handle) return;

  const row = handle.closest('.result-row');
  if (!row || !els.results.contains(row)) return;

  event.preventDefault();
  handle.setPointerCapture?.(event.pointerId);

  resultsDrag = {
    pointerId: event.pointerId,
    row,
    handle,
    startY: event.clientY,
    didDrag: false,
  };

  document.addEventListener('pointermove', onResultsPointerMove);
  document.addEventListener('pointerup', endResultsDrag);
  document.addEventListener('pointercancel', endResultsDrag);
}

// после порога — live insertBefore по половине высоты соседа
function onResultsPointerMove(event) {
  if (!resultsDrag || event.pointerId !== resultsDrag.pointerId) return;

  const dy = Math.abs(event.clientY - resultsDrag.startY);
  if (!resultsDrag.didDrag) {
    if (dy < DRAG_THRESHOLD) return;
    resultsDrag.didDrag = true;
    resultsDrag.row.classList.add('is-dragging');
    els.results.classList.add('is-reordering');
  }

  const over = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest('.result-row');
  if (!over || over === resultsDrag.row || !els.results.contains(over)) return;

  const overRect = over.getBoundingClientRect();
  const before = event.clientY < overRect.top + overRect.height / 2;
  if (before) {
    els.results.insertBefore(resultsDrag.row, over);
  } else {
    els.results.insertBefore(resultsDrag.row, over.nextSibling);
  }
}

function onManageListClick(event) {
  const btn = event.target.closest('[data-move]');
  if (!btn || btn.disabled) return;
  moveTarget(btn.dataset.code, btn.dataset.move);
}

// открытие/закрытие bottom-sheet manage + restore focus
function setManageOpen(open) {
  if (open) {
    manageReturnFocus = document.activeElement;
    els.managePanel.hidden = false;
    els.openManageBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('manage-open');
    els.shell?.setAttribute('inert', '');
    manageQuery = '';
    els.manageSearch.value = '';
    renderManageList();
    els.manageSearch.focus();
  } else {
    els.managePanel.hidden = true;
    els.openManageBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('manage-open');
    els.shell?.removeAttribute('inert');
    const restore = manageReturnFocus || els.openManageBtn;
    manageReturnFocus = null;
    restore?.focus?.();
  }
}

function onManageSearchInput() {
  manageQuery = els.manageSearch.value;
  renderManageList();
}

function onManageTabClick(event) {
  const btn = event.target.closest('[data-tab]');
  if (!btn || !els.manageTabs?.contains(btn)) return;
  const next = btn.dataset.tab;
  if (next !== 'fiat' && next !== 'crypto') return;
  if (manageTab === next) return;
  manageTab = next;
  renderManageList();
}

function onManageBackdropClick(event) {
  if (event.target === els.managePanel) {
    setManageOpen(false);
  }
}

// Escape закрывает; Tab циклит фокус внутри sheet
function onManageKeydown(event) {
  if (els.managePanel.hidden) return;

  if (event.key === 'Escape') {
    setManageOpen(false);
    return;
  }

  if (event.key !== 'Tab' || !els.manageSheet) return;

  const list = getFocusable(els.manageSheet);
  if (!list.length) return;

  const first = list[0];
  const last = list[list.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function onRefresh() {
  await loadRates(state.base, { force: true });
}

// база ↔ первая цель в списке
async function onSwap() {
  const targets = visibleTargets();
  if (!targets.length) return;

  const nextBase = targets[0];
  const prevBase = state.base;
  let nextTargets = state.targets.filter((c) => c !== nextBase);
  if (!nextTargets.includes(prevBase)) nextTargets = [prevBase, ...nextTargets];

  persist({ base: nextBase, targets: nextTargets });
  fillBaseSelect();
  renderManageList();
  els.swapBtn.disabled = visibleTargets().length === 0;
  await loadRates(nextBase, { force: true });
}

// Clipboard API с fallback через textarea + execCommand
async function copyText(text, button) {
  if (!text || text === t(state.locale, 'emptyAmount')) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  if (button) {
    const prev = button.textContent;
    button.textContent = t(state.locale, 'copied');
    clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      button.textContent = prev;
    }, 1200);
  }
}

function onResultsClick(event) {
  if (suppressResultsCopy) {
    suppressResultsCopy = false;
    return;
  }
  if (event.target.closest('[data-drag-handle]')) return;

  const row = event.target.closest('.result-row');
  if (!row) return;

  const removeBtn = event.target.closest('[data-remove-btn]');
  if (removeBtn) {
    if (removeBtn.disabled) return;
    removeTarget(row.dataset.code);
    return;
  }

  const btn = event.target.closest('[data-copy-btn]');
  const text = row.dataset.copy;
  copyText(text, btn || null);
}

// начальные значения контролов и все слушатели
function initControls() {
  els.amount.value = state.amount;
  els.theme.value = state.theme;
  els.locale.value = state.locale;
  applyTheme(state.theme);
  syncAmountClear();

  els.amount.addEventListener('input', onAmountInput);
  els.amountClear?.addEventListener('click', onAmountClear);
  els.base.addEventListener('change', onBaseChange);
  els.theme.addEventListener('change', onThemeChange);
  els.locale.addEventListener('change', onLocaleChange);
  els.manageList.addEventListener('change', onManageChange);
  els.manageList.addEventListener('click', onManageListClick);
  els.manageSearch.addEventListener('input', onManageSearchInput);
  els.manageTabs?.addEventListener('click', onManageTabClick);
  els.openManageBtn.addEventListener('click', () => setManageOpen(true));
  els.closeManageBtn.addEventListener('click', () => setManageOpen(false));
  els.managePanel.addEventListener('click', onManageBackdropClick);
  document.addEventListener('keydown', onManageKeydown);
  els.refreshBtn.addEventListener('click', onRefresh);
  els.swapBtn.addEventListener('click', onSwap);
  els.results.addEventListener('click', onResultsClick);
  els.results.addEventListener('pointerdown', onResultsPointerDown);

  watchSystemTheme(() => {
    if (state.theme === 'system') applyTheme('system');
  });
}

function registerSw() {
  if (!('serviceWorker' in navigator)) return;

  // один reload после смены контроллера, чтобы не остаться на старом SW
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        const checkUpdate = () => {
          registration.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkUpdate();
        });
        window.addEventListener('focus', checkUpdate);
      })
      .catch(() => {});
  });
}

// —— bootstrap ——
applyUrlToState();
initControls();
renderAll();
syncUrlFromState();
loadRates(state.base, { force: isCacheStale(state.ratesCache) });
registerSw();
