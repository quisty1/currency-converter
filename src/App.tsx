import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
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
import {
  CACHE_TTL_MS,
  cryptoCodes,
  fiatCodes,
  urlAsset,
} from './domain/currency';
import { createAppTheme } from './theme';
import {
  resolvePendingLegacyUrl,
  urlHasInvalidSettings,
  useSettings,
} from './store/settings';
import { I18nProvider, formatDate, useI18n } from './i18n/I18nProvider';
import { Header } from './components/Header';
import { ConverterHero } from './components/ConverterHero';
import { ResultsList } from './components/ResultsList';
import { CurrencyManager } from './components/CurrencyManager';

export function AppContent() {
  const { t, locale } = useI18n();
  const { amount, base, targets, theme, setBase, setTargets } = useSettings();
  const [managerOpen, setManagerOpen] = useState(false);
  const [urlCorrected, setUrlCorrected] = useState(urlHasInvalidSettings);
  const query = useQuery({
    queryKey: ['rates'],
    queryFn: ({ signal }) =>
      fetchRates(signal, [
        ...new Set(
          [base, ...targets]
            .filter((id) => id.startsWith('crypto:'))
            .map((id) => id.slice(7)),
        ),
      ]),
    initialData: () => loadRatesCache(),
    initialDataUpdatedAt: () => loadRatesCache()?.fetchedAt,
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
    if (!payload) return;
    const markCorrected = () => window.setTimeout(() => setUrlCorrected(true), 0);
    const pending = resolvePendingLegacyUrl(payload);
    if (pending) {
      if (pending.base) setBase(pending.base);
      if (pending.targets?.length) setTargets(pending.targets);
      markCorrected();
      return;
    }
    const sourceReady = (id: string) =>
      id.startsWith('crypto:')
        ? payload.cryptoStatus === 'success'
        : payload.fiatStatus === 'success';
    const valid = (id: string) =>
      !sourceReady(id) ||
      payload.rates[id] != null ||
      payload.cryptoMeta[id] != null;
    const normalizedTargets = targets.filter(valid);
    if (normalizedTargets.length !== targets.length) {
      setTargets(normalizedTargets);
      markCorrected();
    }
    if (!valid(base)) {
      setBase(payload.base);
      markCorrected();
    }
  }, [base, payload, setBase, setTargets, targets]);

  useEffect(() => {
    // Mirror the current conversion in the URL without adding history entries.
    const params = new URLSearchParams();
    params.set('amount', amount);
    params.set('from', urlAsset(base));
    const visible = targets.filter((code) => code !== base);
    if (visible.length) {
      params.set('to', visible.map(urlAsset).join(','));
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
    const title =
      locale === 'ru'
        ? 'FX Multi — конвертер валют'
        : 'FX Multi — currency converter';
    const description =
      locale === 'ru'
        ? 'Конвертер фиатных валют и криптовалют с несколькими результатами.'
        : 'Fiat and crypto converter with multiple results.';
    document.title = title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', description);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute('content', title);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute('content', description);
  }, [locale]);

  const swap = () => {
    const first = targets.find((code) => code !== base);
    if (!first) return;
    // Promote the previous base into the result list after selecting the first target.
    setBase(first);
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
              {t('totalError')}
            </Alert>
          )}
          {cached && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('error')}
            </Alert>
          )}
          {urlCorrected && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('invalidUrl')}
            </Alert>
          )}
          {payload?.fiatStatus === 'error' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('fiatUnavailable')}
            </Alert>
          )}
          {payload?.cryptoStatus === 'error' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('cryptoUnavailable')}
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
            <Stack
              direction="row"
              gap={1}
              alignItems="flex-start"
              sx={{ minWidth: 0, maxWidth: '100%' }}
            >
              {cached ? (
                <CloudOffRounded fontSize="small" />
              ) : (
                <WifiRounded fontSize="small" />
              )}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {query.isFetching
                  ? t('loading')
                  : payload
                    ? `${payload.fiatStatus === 'success' ? t('fiatUpdated', { date: formatDate(locale, payload.fiatUpdatedAt || payload.date) }) : t('fiatUnavailable')} · ${payload.cryptoStatus === 'success' ? t('cryptoUpdated', { date: formatDate(locale, payload.cryptoUpdatedAt || new Date(payload.fetchedAt).toISOString()) }) : t('cryptoUnavailable')} · ${t('checkedAt', { date: formatDate(locale, new Date(payload.fetchedAt).toISOString()) })}`
                    : t('loading')}
              </Typography>
            </Stack>
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
  const muiTheme = useMemo(() => createAppTheme(mode, locale), [mode, locale]);
  return (
    <ThemeProvider theme={muiTheme}>
      <I18nProvider locale={locale}>
        <AppContent />
      </I18nProvider>
    </ThemeProvider>
  );
}
