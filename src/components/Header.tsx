import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CurrencyExchangeRounded from '@mui/icons-material/CurrencyExchangeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import SettingsBrightnessRounded from '@mui/icons-material/SettingsBrightnessRounded';
import { useI18n } from '../i18n/I18nProvider';
import { useSettings } from '../store/settings';
import type { ThemeMode } from '../domain/types';

export function Header() {
  const { t } = useI18n();
  const { locale, theme, setLocale, setTheme } = useSettings();
  const themeIcon =
    theme === 'light' ? (
      <LightModeRounded />
    ) : theme === 'dark' ? (
      <DarkModeRounded />
    ) : (
      <SettingsBrightnessRounded />
    );
  const nextTheme: Record<ThemeMode, ThemeMode> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  };

  return (
    <Stack
      component="header"
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      py={{ xs: 2, md: 3 }}
      gap={2}
    >
      <Stack direction="row" alignItems="center" gap={1.25}>
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 42,
            height: 42,
            borderRadius: 3,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: '0 10px 28px rgba(49,89,217,.25)',
          }}
        >
          <CurrencyExchangeRounded />
        </Box>
        <Box>
          <Typography
            variant="h6"
            component="div"
            fontWeight={800}
            lineHeight={1}
          >
            FX Multi
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            {t('tagline')}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" gap={1} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 78 }}>
          <InputLabel id="locale-label">{t('language')}</InputLabel>
          <Select
            labelId="locale-label"
            value={locale}
            label={t('language')}
            onChange={(event) => setLocale(event.target.value)}
          >
            <MenuItem value="ru">RU</MenuItem>
            <MenuItem value="en">EN</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title={`${t('theme')}: ${t(theme)}`}>
          <IconButton
            aria-label={`${t('theme')}: ${t(theme)}`}
            onClick={() => setTheme(nextTheme[theme])}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}
          >
            {themeIcon}
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
