// системная тёмная тема (prefers-color-scheme)
const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

// light/dark как есть; system — по MEDIA
export function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return MEDIA.matches ? 'dark' : 'light';
}

// пишет data-theme (фактическая) и data-theme-mode (выбор пользователя)
// на <html> для CSS
export function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = theme;
  return resolved;
}

// подписка на смену системной темы
// возвращает unsubscribe; addListener — fallback для старых Safari
export function watchSystemTheme(onChange) {
  const handler = () => onChange();
  if (MEDIA.addEventListener) {
    MEDIA.addEventListener('change', handler);
    return () => MEDIA.removeEventListener('change', handler);
  }
  MEDIA.addListener(handler);
  return () => MEDIA.removeListener(handler);
}
