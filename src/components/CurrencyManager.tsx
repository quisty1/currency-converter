import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { cryptoCodes, fiatCodes } from '../domain/currency';
import type { RatesPayload } from '../domain/types';
import { currencyName, useI18n } from '../i18n/I18nProvider';
import { useSettings } from '../store/settings';
import { CurrencyAvatar } from './CurrencyAvatar';

export function CurrencyManager({
  open,
  onClose,
  payload,
}: {
  open: boolean;
  onClose: () => void;
  payload?: RatesPayload;
}) {
  const { locale, t } = useI18n();
  const { base, targets, setTargets } = useSettings();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState<'fiat' | 'crypto'>('fiat');
  const [search, setSearch] = useState('');
  const codes = tab === 'fiat' ? fiatCodes(payload) : cryptoCodes(payload);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return codes.filter(
      (code) =>
        !query ||
        code.toLowerCase().includes(query) ||
        currencyName(locale, code, payload)
          .toLocaleLowerCase(locale)
          .includes(query),
    );
  }, [codes, locale, payload, search]);
  const toggle = (code: string) => {
    if (code === base) return;
    setTargets(
      targets.includes(code)
        ? targets.filter((item) => item !== code)
        : [...targets, code],
    );
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 4,
          minHeight: fullScreen ? '100%' : 620,
          padding: '10px',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography
          component="span"
          variant="h5"
          display="block"
          fontWeight={800}
        >
          {t('manageTitle')}
        </Typography>
        <Typography
          component="span"
          variant="body2"
          display="block"
          color="text.secondary"
          mt={0.5}
        >
          {t('manageHint')}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
        <TextField
          autoFocus
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('search')}
          inputProps={{ 'aria-label': t('search') }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded />
              </InputAdornment>
            ),
          }}
          sx={{ my: 2 }}
        />
        <Tabs
          value={tab}
          onChange={(_, value) => {
            const nextTab: unknown = value;
            if (nextTab === 'fiat' || nextTab === 'crypto') {
              setTab(nextTab);
            }
          }}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
        >
          <Tab value="fiat" label={t('fiat')} />
          <Tab value="crypto" label={t('crypto')} />
        </Tabs>
        <Stack direction="row" gap={1} alignItems="center" py={1}>
          <Typography variant="overline" color="text.secondary">
            {t('selected')}
          </Typography>
          <Chip
            size="small"
            color="primary"
            label={targets.filter((code) => code !== base).length}
          />
        </Stack>
        {filtered.length ? (
          <List disablePadding>
            {filtered.map((code) => {
              const checked = code === base || targets.includes(code);
              return (
                <ListItemButton
                  key={code}
                  onClick={() => toggle(code)}
                  disabled={code === base}
                  sx={{ borderRadius: 2.5, mb: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 48 }}>
                    <CurrencyAvatar code={code} payload={payload} size={34} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<b>{code}</b>}
                    secondary={currencyName(locale, code, payload)}
                  />
                  <Checkbox
                    edge="end"
                    checked={checked}
                    disabled={code === base}
                    inputProps={{
                      'aria-label': `${checked ? t('remove') : t('selected')} ${code}`,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        ) : (
          <Box py={8} textAlign="center">
            <Typography color="text.secondary">{t('empty')}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} variant="contained" size="large" fullWidth>
          {t('done')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
