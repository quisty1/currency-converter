const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

export function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return MEDIA.matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = theme;
  return resolved;
}

export function watchSystemTheme(onChange) {
  const handler = () => onChange();
  if (MEDIA.addEventListener) {
    MEDIA.addEventListener('change', handler);
    return () => MEDIA.removeEventListener('change', handler);
  }
  MEDIA.addListener(handler);
  return () => MEDIA.removeListener(handler);
}
