// ISO 4217 → ISO 3166-1 alpha-2 (or EU for euro)
// null — no flag (metals, baskets, special codes)
const CURRENCY_COUNTRY = {
  USD: 'US',
  EUR: 'EU',
  RUB: 'RU',
  TRY: 'TR',
  GBP: 'GB',
  JPY: 'JP',
  CNY: 'CN',
  CHF: 'CH',
  PLN: 'PL',
  CAD: 'CA',
  AUD: 'AU',
  UAH: 'UA',
  KZT: 'KZ',
  BYN: 'BY',
  SEK: 'SE',
  NOK: 'NO',
  DKK: 'DK',
  CZK: 'CZ',
  HUF: 'HU',
  RON: 'RO',
  BGN: 'BG',
  INR: 'IN',
  BRL: 'BR',
  MXN: 'MX',
  KRW: 'KR',
  SGD: 'SG',
  HKD: 'HK',
  NZD: 'NZ',
  ZAR: 'ZA',
  AED: 'AE',
  THB: 'TH',
  ILS: 'IL',
  AFN: 'AF',
  ALL: 'AL',
  AMD: 'AM',
  ANG: 'CW',
  AOA: 'AO',
  ARS: 'AR',
  AWG: 'AW',
  AZN: 'AZ',
  BAM: 'BA',
  BBD: 'BB',
  BDT: 'BD',
  BHD: 'BH',
  BIF: 'BI',
  BMD: 'BM',
  BND: 'BN',
  BOB: 'BO',
  BSD: 'BS',
  BTN: 'BT',
  BWP: 'BW',
  BZD: 'BZ',
  CDF: 'CD',
  CLP: 'CL',
  COP: 'CO',
  CRC: 'CR',
  CUP: 'CU',
  CVE: 'CV',
  DJF: 'DJ',
  DOP: 'DO',
  DZD: 'DZ',
  EGP: 'EG',
  ERN: 'ER',
  ETB: 'ET',
  FJD: 'FJ',
  FKP: 'FK',
  GEL: 'GE',
  GGP: 'GG',
  GHS: 'GH',
  GIP: 'GI',
  GMD: 'GM',
  GNF: 'GN',
  GTQ: 'GT',
  GYD: 'GY',
  HNL: 'HN',
  HRK: 'HR',
  HTG: 'HT',
  IDR: 'ID',
  IQD: 'IQ',
  IRR: 'IR',
  ISK: 'IS',
  JEP: 'JE',
  JMD: 'JM',
  JOD: 'JO',
  KES: 'KE',
  KGS: 'KG',
  KHR: 'KH',
  KMF: 'KM',
  KPW: 'KP',
  KWD: 'KW',
  KYD: 'KY',
  LAK: 'LA',
  LBP: 'LB',
  LKR: 'LK',
  LRD: 'LR',
  LSL: 'LS',
  LYD: 'LY',
  MAD: 'MA',
  MDL: 'MD',
  MGA: 'MG',
  MKD: 'MK',
  MMK: 'MM',
  MNT: 'MN',
  MOP: 'MO',
  MRU: 'MR',
  MUR: 'MU',
  MVR: 'MV',
  MWK: 'MW',
  MYR: 'MY',
  MZN: 'MZ',
  NAD: 'NA',
  NGN: 'NG',
  NIO: 'NI',
  NPR: 'NP',
  OMR: 'OM',
  PAB: 'PA',
  PEN: 'PE',
  PGK: 'PG',
  PHP: 'PH',
  PKR: 'PK',
  PYG: 'PY',
  QAR: 'QA',
  RSD: 'RS',
  RWF: 'RW',
  SAR: 'SA',
  SBD: 'SB',
  SCR: 'SC',
  SDG: 'SD',
  SHP: 'SH',
  SLE: 'SL',
  SLL: 'SL',
  SOS: 'SO',
  SRD: 'SR',
  SSP: 'SS',
  STN: 'ST',
  SYP: 'SY',
  SZL: 'SZ',
  TJS: 'TJ',
  TMT: 'TM',
  TND: 'TN',
  TOP: 'TO',
  TTD: 'TT',
  TWD: 'TW',
  TZS: 'TZ',
  UGX: 'UG',
  UYU: 'UY',
  UZS: 'UZ',
  VES: 'VE',
  VND: 'VN',
  VUV: 'VU',
  WST: 'WS',
  XAF: 'CM',
  XCD: 'AG',
  XOF: 'SN',
  XPF: 'PF',
  YER: 'YE',
  ZMW: 'ZM',
  ZWL: 'ZW',
  XAU: null,
  XAG: null,
  XPT: null,
  XPD: null,
  XDR: null,
};

// ISO 4217 → country or null
export function currencyCountry(code) {
  const upper = String(code || '').toUpperCase();
  if (!upper) return null;
  if (Object.prototype.hasOwnProperty.call(CURRENCY_COUNTRY, upper)) {
    return CURRENCY_COUNTRY[upper];
  }
  // IMF / metal / test special codes
  if (upper.startsWith('X')) return null;
  return null;
}

// alpha-2 → PNG flag URL (flagcdn; Windows emoji flags render as letters)
export function flagUrl(code) {
  const country = currencyCountry(code);
  if (!country || country.length !== 2) return '';
  return `https://flagcdn.com/w40/${country.toLowerCase()}.png`;
}

// flag image markup for lists; empty string if there is no flag
export function flagMarkup(code) {
  const src = flagUrl(code);
  if (!src) return '';
  return `<span class="flag" aria-hidden="true"><img src="${src}" alt="" width="20" height="15" loading="lazy" decoding="async" onerror="this.closest('.flag')?.remove()" /></span>`;
}

// crypto icon URL from cryptoMeta
export function cryptoIconUrl(code, cryptoMeta) {
  const upper = String(code || '').toUpperCase();
  const src = cryptoMeta?.[upper]?.image;
  return typeof src === 'string' && src ? src : '';
}

// flag for fiat, round icon for crypto, otherwise empty
export function assetMarkup(code, cryptoMeta = null) {
  const cryptoSrc = cryptoIconUrl(code, cryptoMeta);
  if (cryptoSrc) {
    const safe = cryptoSrc.replace(/"/g, '&quot;');
    return `<span class="asset-icon" aria-hidden="true"><img src="${safe}" alt="" width="20" height="20" loading="lazy" decoding="async" onerror="this.closest('.asset-icon')?.remove()" /></span>`;
  }
  return flagMarkup(code);
}

// asset image URL for the base-flag (crypto or flag)
export function assetUrl(code, cryptoMeta = null) {
  return cryptoIconUrl(code, cryptoMeta) || flagUrl(code);
}
