import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Stack,
  ThemeProvider,
  Typography,
  useMediaQuery,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import WifiRounded from '@mui/icons-material/WifiRounded';
import CloudOffRounded from '@mui/icons-material/CloudOffRounded';
import { fetchRates, loadRatesCache } from './api/rates';
import { CACHE_TTL_MS, cryptoCodes, fiatCodes } from './domain/currency';
import { createAppTheme } from './theme';
import { useSettings } from './store/settings';
import { I18nProvider, formatDate, useI18n } from './i18n/I18nProvider';
import { Header } from './components/Header';
import { ConverterHero } from './components/ConverterHero';
import { ResultsList } from './components/ResultsList';
import { CurrencyManager } from './components/CurrencyManager';

// Read once during module initialization so React Query receives stable initial data.
const cachedRates = loadRatesCache();

function AppContent() {
  const { t, locale } = useI18n();
  const { amount, base, targets, theme, setBase, setTargets } = useSettings();
  const [managerOpen, setManagerOpen] = useState(false);
  const query = useQuery({
    queryKey: ['rates'],
    queryFn: ({ signal }) => fetchRates(signal),
    initialData: cachedRates,
    initialDataUpdatedAt: cachedRates?.fetchedAt,
    staleTime: CACHE_TTL_MS,
    retry: 2,
    refetchOnWindowFocus: true,
  });
  const payload = query.data;
  const codes = useMemo(
    () => [...new Set([...fiatCodes(payload), ...cryptoCodes(payload)])],
    [payload],
  );

  useEffect(() => {
    // Mirror the current conversion in the URL without adding history entries.
    const params = new URLSearchParams();
    params.set('amount', amount);
    params.set('from', base);
    const visible = targets.filter((code) => code !== base);
    if (visible.length) {
      params.set('to', visible.join(','));
    }
    params.set('locale', locale);
    if (theme !== 'system') params.set('theme', theme);
    const next = `${location.pathname}?${params}`;
    if (`${location.pathname}${location.search}` !== next) {
      history.replaceState(null, '', next);
    }
  }, [amount, base, targets, locale, theme]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === 'ru'
        ? 'FX Multi — конвертер валют'
        : 'FX Multi — currency converter';
  }, [locale]);

  const swap = () => {
    const first = targets.find((code) => code !== base);
    if (!first) return;
    // Promote the previous base into the result list after selecting the first target.
    setBase(first);
    setTargets([
      base,
      ...targets.filter((code) => code !== first && code !== base),
    ]);
  };
  const cached = Boolean(payload && query.isError);

  return (
    <>
      <CssBaseline />
      <Box
        component="a"
        href="#converter"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 2000,
          transform: 'translateY(-150%)',
          '&:focus': { transform: 'none' },
          bgcolor: 'background.paper',
          p: 1,
          borderRadius: 1,
        }}
      >
        {t('skip')}
      </Box>
      <Container maxWidth="md" sx={{ pb: 8 }}>
        <Header />
        <Box component="main">
          <ConverterHero payload={payload} codes={codes} onSwap={swap} />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={1.5}
            mt={4}
            mb={2}
          >
            <Box>
              <Typography variant="h4" component="h1">
                {t('results')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('tagline')}
              </Typography>
            </Box>
            <Button
              startIcon={<AddRounded />}
              variant="outlined"
              onClick={() => setManagerOpen(true)}
            >
              {t('editList')}
            </Button>
          </Stack>
          {query.isError && !payload && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {t('error')}
            </Alert>
          )}
          {cached && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('error')}
            </Alert>
          )}
          <ResultsList payload={payload} loading={query.isPending} />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={1.5}
            mt={2.5}
          >
            <Chip
              icon={cached ? <CloudOffRounded /> : <WifiRounded />}
              label={
                query.isFetching
                  ? t('loading')
                  : payload
                    ? `${cached ? t('offlineRates') : t('liveRates')} · ${formatDate(locale, payload.date)}`
                    : t('loading')
              }
              variant="outlined"
            />
            <Button
              startIcon={
                query.isFetching ? (
                  <CircularProgress size={17} />
                ) : (
                  <RefreshRounded />
                )
              }
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              {t('refresh')}
            </Button>
          </Stack>
        </Box>
      </Container>
      <CurrencyManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        payload={payload}
      />
    </>
  );
}

export default function App() {
  const { locale, theme } = useSettings();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const mode = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const muiTheme = useMemo(() => createAppTheme(mode), [mode]);
  return (
    <ThemeProvider theme={muiTheme}>
      <I18nProvider locale={locale}>
        <AppContent />
      </I18nProvider>
    </ThemeProvider>
  );
}
