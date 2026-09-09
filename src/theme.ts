import { createTheme, type PaletteMode } from '@mui/material/styles';

export function createAppTheme(mode: PaletteMode) {
  return createTheme({
    // Expose palette tokens as CSS variables for consistent runtime theming.
    cssVariables: true,
    palette: {
      mode,
      primary: { main: mode === 'light' ? '#3159d9' : '#9cb2ff' },
      secondary: { main: '#16a394' },
      background:
        mode === 'light'
          ? { default: '#f4f6fb', paper: '#ffffff' }
          : { default: '#0d111b', paper: '#151b27' },
    },
    shape: { borderRadius: 18 },
    typography: {
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 800, letterSpacing: '-0.045em' },
      h2: { fontWeight: 750, letterSpacing: '-0.03em' },
      button: { fontWeight: 700, textTransform: 'none' },
    },
    components: {
      // Centralize shared component defaults instead of repeating them in views.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 12 } },
      },
      MuiCard: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none' } } },
      MuiTextField: { defaultProps: { variant: 'outlined' } },
    },
  });
}
