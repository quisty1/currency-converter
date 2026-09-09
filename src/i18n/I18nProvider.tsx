/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale, RatesPayload } from '../domain/types';
import { assetCode } from '../domain/currency';

const dictionaries = {
  ru: {
    tagline: 'Одна сумма — сразу во всех нужных валютах',
    amount: 'Сумма',
    from: 'Из валюты',
    results: 'Результаты',
    currencies: 'Валюты',
    editList: 'Настроить список',
    updated: 'Курсы обновлены {date}',
    cached: 'Сохранённые курсы от {date}',
    loading: 'Обновляем курсы…',
    error: 'Не удалось обновить курсы. Используем сохранённые данные.',
    totalError:
      'Не удалось загрузить курсы. Проверьте подключение и повторите попытку.',
    refresh: 'Обновить курсы',
    swap: 'Поменять местами',
    copied: 'Скопировано',
    copy: 'Копировать',
    search: 'Название или код валюты',
    fiat: 'Фиат',
    crypto: 'Крипто',
    done: 'Готово',
    manageTitle: 'Настройте результаты',
    manageHint:
      'Выберите валюты. Порядок можно изменить перетаскиванием карточек результата.',
    selected: 'Выбрано',
    allCurrencies: 'Все валюты',
    empty: 'Ничего не найдено',
    remove: 'Убрать',
    theme: 'Тема',
    language: 'Язык',
    system: 'Системная',
    light: 'Светлая',
    dark: 'Тёмная',
    invalidAmount: 'Введите корректное число',
    noRate: 'Курс недоступен',
    rate: '1 {from} = {value}',
    liveRates: 'Актуальные курсы',
    offlineRates: 'Кешированные курсы',
    drag: 'Изменить порядок',
    settings: 'Настройки',
    skip: 'К конвертеру',
    clear: 'Очистить',
    add: 'Добавить',
    fiatUnavailable: 'Фиатные курсы недоступны',
    cryptoUnavailable: 'Криптокурсы недоступны',
    checkedAt: 'Последняя проверка: {date}',
    invalidUrl: 'Некорректные параметры ссылки были исправлены.',
    copyFailed: 'Не удалось скопировать результат',
    fiatUpdated: 'Фиат: {date}',
    cryptoUpdated: 'Крипто: {date}',
  },
  en: {
    tagline: 'One amount in every currency you need',
    amount: 'Amount',
    from: 'From currency',
    results: 'Results',
    currencies: 'Currencies',
    editList: 'Edit list',
    updated: 'Rates updated {date}',
    cached: 'Saved rates from {date}',
    loading: 'Updating rates…',
    error: 'Could not refresh rates. Using saved data.',
    totalError: 'Could not load rates. Check your connection and try again.',
    refresh: 'Refresh rates',
    swap: 'Swap currencies',
    copied: 'Copied',
    copy: 'Copy',
    search: 'Currency name or code',
    fiat: 'Fiat',
    crypto: 'Crypto',
    done: 'Done',
    manageTitle: 'Customize results',
    manageHint: 'Choose currencies. Drag result cards to change their order.',
    selected: 'Selected',
    allCurrencies: 'All currencies',
    empty: 'Nothing found',
    remove: 'Remove',
    theme: 'Theme',
    language: 'Language',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    invalidAmount: 'Enter a valid number',
    noRate: 'Rate unavailable',
    rate: '1 {from} = {value}',
    liveRates: 'Live rates',
    offlineRates: 'Cached rates',
    drag: 'Reorder',
    settings: 'Settings',
    skip: 'Skip to converter',
    clear: 'Clear',
    add: 'Add',
    fiatUnavailable: 'Fiat rates unavailable',
    cryptoUnavailable: 'Crypto rates unavailable',
    checkedAt: 'Last checked: {date}',
    invalidUrl: 'Invalid link parameters were corrected.',
    copyFailed: 'Could not copy the result',
    fiatUpdated: 'Fiat: {date}',
    cryptoUpdated: 'Crypto: {date}',
  },
} as const;

type TranslationKey = keyof typeof dictionaries.ru;
interface I18nValue {
  locale: Locale;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: (key, vars = {}) => {
        let text: string = dictionaries[locale][key];
        for (const [name, replacement] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(replacement));
        }
        return text;
      },
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

const localeTag = (locale: Locale) => (locale === 'ru' ? 'ru-RU' : 'en-US');

export function currencyName(
  locale: Locale,
  code: string,
  payload?: RatesPayload | null,
) {
  if (payload?.cryptoMeta[code]?.name) return payload.cryptoMeta[code].name;
  const upper = assetCode(code, payload).toUpperCase();
  try {
    return (
      new Intl.DisplayNames(localeTag(locale), { type: 'currency' }).of(
        upper,
      ) || upper
    );
  } catch {
    return upper;
  }
}

export function formatValue(
  locale: Locale,
  amount: number | null,
  code: string,
  payload?: RatesPayload | null,
) {
  if (amount == null || !Number.isFinite(amount)) return '—';
  const isCrypto = code.startsWith('crypto:');
  // Preserve useful precision for small crypto values without over-formatting fiat.
  const digits = isCrypto
    ? Math.abs(amount) >= 1
      ? 4
      : 8
    : Math.abs(amount) >= 100
      ? 2
      : 4;
  const value = new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: digits,
  }).format(amount);
  return `${value} ${assetCode(code, payload)}`;
}

export function formatDate(locale: Locale, value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(localeTag(locale), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}
