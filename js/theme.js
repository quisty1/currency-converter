// system dark theme (prefers-color-scheme)
const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

// light/dark as-is; system follows MEDIA
export function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return MEDIA.matches ? 'dark' : 'light';
}

// set data-theme (resolved) and data-theme-mode (user choice)
// on <html> for CSS
export function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = theme;
  return resolved;
}

// subscribe to system theme changes
// returns unsubscribe; addListener is a fallback for older Safari
export function watchSystemTheme(onChange) {
  const handler = () => onChange();
  if (MEDIA.addEventListener) {
    MEDIA.addEventListener('change', handler);
    return () => MEDIA.removeEventListener('change', handler);
  }
  MEDIA.addListener(handler);
  return () => MEDIA.removeListener(handler);
}
