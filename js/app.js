// UI entry: conversion, currency list,
// theme/locale, URL sync, drag-reorder, PWA SW
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

// focusable elements inside the manage sheet (Tab trap)
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// cached DOM refs; i18n nodes + interactive controls
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
  baseInput: document.getElementById('base-input'),
  baseListbox: document.getElementById('base-listbox'),
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
// current rates payload (live or cached)
let ratesPayload = state.ratesCache;
// showing rates from localStorage; network pending or failed
let usingCache = false;
// cache older than TTL
let cacheStale = false;
let loading = false;
// search filter in the currency manager
let manageQuery = '';
// modal tab: fiat | crypto
let manageTab = 'fiat';
// FROM combobox: query, open state, active option index
let baseQuery = '';
let baseOpen = false;
let baseActiveIndex = -1;
// cached codes for the listbox (fiat / crypto)
let baseFiatCodes = [];
let baseCryptoCodes = [];
// AbortController for the current fetchRates
let ratesAbort = null;
// where to restore focus after closing manage
let manageReturnFocus = null;
// timer to reset the "Copied" button text
let copyResetTimer = null;
// guard against a replaceState ↔ popstate loop
let syncingUrl = false;
// pointer-drag state for a result row
let resultsDrag = null;
// after a drag, skip copy on the following click
let suppressResultsCopy = false;

// px before reorder starts (filters out a click)
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

// save a partial and sync the query string
function persist(partial) {
  state = saveState(state, partial);
  syncUrlFromState();
  return state;
}

// normalize input: spaces, comma → dot
function parseAmount(raw) {
  const normalized = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return NaN;
  return Number(normalized);
}

// empty field is not an error; non-numeric is
function amountIsInvalid() {
  const raw = String(els.amount.value).trim();
  if (!raw) return false;
  return !Number.isFinite(parseAmount(raw));
}

// amount clear button
function syncAmountClear() {
  if (!els.amountClear) return;
  els.amountClear.hidden = String(els.amount.value).length === 0;
}

// targets excluding the base (base is not duplicated in results)
function visibleTargets() {
  return state.targets.filter((code) => code !== state.base);
}

function getFocusable(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

// absolute URLs for OG/canonical/JSON-LD
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
      // leave broken JSON-LD alone
    }
  }
}

// loading indicators: refresh spinner, aria-busy, list opacity
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

// apply ?amount&from&to&locale&theme to state on startup
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
      // base always stays in targets, even if missing from to=
      patch.targets = [...new Set([base, ...codes])];
    }
  }

  if (Object.keys(patch).length) {
    state = saveState(state, patch);
  }
}

// write current state to the URL without adding history
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

// apply texts/aria/placeholders from data-i18n* and theme options
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

function baseDisplayLabel(code) {
  return `${code} — ${nameOf(code)}`;
}

function syncBaseInputDisplay() {
  if (!els.baseInput) return;
  const code = els.base.value || state.base;
  els.baseInput.value = code ? baseDisplayLabel(code) : '';
}

// cached codes + hidden #base value + input label
function fillBaseSelect() {
  const previous = state.base;
  const payload = ratesPayload || state.ratesCache;
  let fiat = fiatCodes(payload);
  let crypto = cryptoCodes(payload);

  if (previous && !fiat.includes(previous) && !crypto.includes(previous)) {
    // unknown code from state goes in the fiat group
    fiat = [...fiat, previous].sort();
  }

  baseFiatCodes = fiat;
  baseCryptoCodes = crypto;

  const all = [...fiat, ...crypto];
  els.base.value = all.includes(previous) ? previous : all[0] || 'USD';
  syncBaseInputDisplay();
  syncBaseFlag();
  if (baseOpen) renderBaseList(baseQuery);
}

function visibleBaseOptions(query) {
  const q = query.trim().toLowerCase();
  const match = (code) => {
    if (!q) return true;
    const name = nameOf(code).toLowerCase();
    return code.toLowerCase().includes(q) || name.includes(q);
  };
  return {
    fiat: baseFiatCodes.filter(match),
    crypto: baseCryptoCodes.filter(match),
  };
}

function flatBaseOptions(query) {
  const { fiat, crypto } = visibleBaseOptions(query);
  return [...fiat, ...crypto];
}

function setBaseActiveIndex(index) {
  if (!els.baseListbox) return;
  const options = els.baseListbox.querySelectorAll('[role="option"]');
  baseActiveIndex = index;
  options.forEach((el, i) => {
    const active = i === index;
    el.classList.toggle('is-active', active);
    if (active) {
      els.baseInput?.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    }
  });
  if (index < 0) els.baseInput?.removeAttribute('aria-activedescendant');
}

function renderBaseList(query = baseQuery) {
  if (!els.baseListbox) return;
  const meta = currentCryptoMeta();
  const { fiat, crypto } = visibleBaseOptions(query);
  const selected = els.base.value || state.base;
  const parts = [];
  let optIndex = 0;

  const pushGroup = (label, codes) => {
    if (!codes.length) return;
    parts.push(
      `<li class="base-listbox-group" role="presentation">${label}</li>`,
    );
    for (const code of codes) {
      const id = `base-option-${optIndex}`;
      const isSelected = code === selected;
      parts.push(`
        <li
          id="${id}"
          class="base-listbox-option${isSelected ? ' is-selected' : ''}"
          role="option"
          data-code="${code}"
          aria-selected="${isSelected ? 'true' : 'false'}"
        >
          ${assetMarkup(code, meta)}
          <span class="base-option-code">${code}</span>
          <span class="base-option-name">${nameOf(code)}</span>
        </li>
      `);
      optIndex += 1;
    }
  };

  pushGroup(t(state.locale, 'groupFiat'), fiat);
  pushGroup(t(state.locale, 'groupCrypto'), crypto);

  if (!optIndex) {
    els.baseListbox.innerHTML = `<li class="base-listbox-empty" role="presentation">${t(state.locale, 'searchEmpty')}</li>`;
    setBaseActiveIndex(-1);
    return;
  }

  els.baseListbox.innerHTML = parts.join('');
  const flat = [...fiat, ...crypto];
  const selectedIdx = flat.indexOf(selected);
  setBaseActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
}

function openBaseListbox({ selectText = false } = {}) {
  if (!els.baseListbox || !els.baseInput) return;
  baseOpen = true;
  els.baseListbox.hidden = false;
  els.baseInput.setAttribute('aria-expanded', 'true');
  renderBaseList(baseQuery);
  if (selectText) els.baseInput.select();
}

function closeBaseListbox({ restore = true } = {}) {
  if (!els.baseListbox || !els.baseInput) return;
  baseOpen = false;
  baseQuery = '';
  baseActiveIndex = -1;
  els.baseListbox.hidden = true;
  els.baseListbox.innerHTML = '';
  els.baseInput.setAttribute('aria-expanded', 'false');
  els.baseInput.removeAttribute('aria-activedescendant');
  if (restore) syncBaseInputDisplay();
}

async function selectBaseCode(code) {
  if (!code || code === els.base.value) {
    closeBaseListbox({ restore: true });
    return;
  }
  els.base.value = code;
  baseQuery = '';
  syncBaseInputDisplay();
  closeBaseListbox({ restore: false });
  await onBaseChange();
}

function onBaseInputFocus() {
  baseQuery = '';
  openBaseListbox({ selectText: true });
}

function onBaseInputInput() {
  baseQuery = els.baseInput.value;
  if (!baseOpen) openBaseListbox();
  else renderBaseList(baseQuery);
}

function onBaseInputKeydown(event) {
  const flat = flatBaseOptions(baseQuery);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!baseOpen) {
      openBaseListbox();
      return;
    }
    const next = baseActiveIndex < flat.length - 1 ? baseActiveIndex + 1 : 0;
    setBaseActiveIndex(next);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (!baseOpen) {
      openBaseListbox();
      return;
    }
    const next = baseActiveIndex > 0 ? baseActiveIndex - 1 : flat.length - 1;
    setBaseActiveIndex(next);
    return;
  }

  if (event.key === 'Enter') {
    if (!baseOpen) return;
    event.preventDefault();
    const code = flat[baseActiveIndex];
    if (code) void selectBaseCode(code);
    return;
  }

  if (event.key === 'Escape') {
    if (!baseOpen) return;
    event.preventDefault();
    closeBaseListbox({ restore: true });
    els.baseInput.blur();
  }
}

function onBaseListboxClick(event) {
  const option = event.target.closest('[role="option"][data-code]');
  if (!option) return;
  event.preventDefault();
  void selectBaseCode(option.dataset.code);
}

function onBaseComboboxBlur() {
  // clicking an option blurs before click — delay close
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active === els.baseInput || els.baseListbox?.contains(active)) {
      return;
    }
    closeBaseListbox({ restore: true });
  });
}

function onDocumentPointerDownBase(event) {
  if (!baseOpen) return;
  const wrap = els.baseInput?.closest('.base-select-wrap');
  if (wrap?.contains(event.target)) return;
  closeBaseListbox({ restore: true });
}

// flag/icon next to the base combobox
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

// checkboxes + reorder arrows in the manage panel (per tab)
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

// result rows: amount, unit rate, drag-handle, copy
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

// status line: amount error / loading / cache / fresh rates
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

// load rates: fiat (USD) + crypto in parallel, then merge
// fresh cache skips the network; otherwise stale-while-revalidate + force
async function loadRates(base = state.base, { force = false } = {}) {
  if (ratesAbort) ratesAbort.abort();
  ratesAbort = new AbortController();
  const { signal } = ratesAbort;
  const requestBase = base;

  const cached = state.ratesCache;
  const stale = isCacheStale(cached);

  // cache without cryptoMeta is incomplete (old fiat-only) — fetch
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

  // show cache immediately while the network request runs
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
    // fiat is always vs USD (API does not accept crypto as base)
    const [fiatResult, cryptoResult] = await Promise.allSettled([
      fetchRates('USD', { signal }),
      fetchCryptoMarkets({ signal }),
    ]);

    if (signal.aborted || requestBase !== state.base) return;

    const fiatPayload =
      fiatResult.status === 'fulfilled' ? fiatResult.value : null;
    const cryptoPayload =
      cryptoResult.status === 'fulfilled' ? cryptoResult.value : null;

    // on partial failure, fill gaps from cache
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

// change base: keep it in targets, fallback target, force reload
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

// remove a currency; cannot drop the last non-base target
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

// currency checkbox; cannot uncheck the last non-base target
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

// reorder visibleTargets; base stays at the start of the Set
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

// result row order from DOM → state.targets
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
    // already released
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

// past the threshold, live insertBefore at the neighbor's midpoint
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

// open/close the manage bottom-sheet + restore focus
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

// Escape closes; Tab cycles focus inside the sheet
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

// swap base ↔ first target in the list
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

// Clipboard API with a textarea + execCommand fallback
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

// initial control values and all listeners
function initControls() {
  els.amount.value = state.amount;
  els.theme.value = state.theme;
  els.locale.value = state.locale;
  applyTheme(state.theme);
  syncAmountClear();

  els.amount.addEventListener('input', onAmountInput);
  els.amountClear?.addEventListener('click', onAmountClear);
  els.baseInput?.addEventListener('focus', onBaseInputFocus);
  els.baseInput?.addEventListener('input', onBaseInputInput);
  els.baseInput?.addEventListener('keydown', onBaseInputKeydown);
  els.baseInput?.addEventListener('blur', onBaseComboboxBlur);
  els.baseListbox?.addEventListener('mousedown', (event) => {
    // keep the input focused until an option is clicked
    event.preventDefault();
  });
  els.baseListbox?.addEventListener('click', onBaseListboxClick);
  document.addEventListener('pointerdown', onDocumentPointerDownBase);
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

  // one reload after a controller change so we do not stay on the old SW
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
