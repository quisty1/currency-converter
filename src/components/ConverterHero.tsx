import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import SwapVertRounded from '@mui/icons-material/SwapVertRounded';
import { CurrencyAvatar } from './CurrencyAvatar';
import { currencyName, useI18n } from '../i18n/I18nProvider';
import { assetCode, parseAmount } from '../domain/currency';
import type { RatesPayload } from '../domain/types';
import { useSettings } from '../store/settings';

export function ConverterHero({
  payload,
  codes,
  onSwap,
}: {
  payload?: RatesPayload;
  codes: string[];
  onSwap: () => void;
}) {
  const { locale, t } = useI18n();
  const { amount, base, targets, setAmount, setBase } = useSettings();
  const invalid = amount.trim() !== '' && parseAmount(amount, locale) == null;
  const canSwap = targets.some((code) => code !== base);
  return (
    <Card
      id="converter"
      elevation={0}
      sx={{
        overflow: 'visible',
        color: 'common.white',
        background:
          'linear-gradient(135deg, #2446b8 0%, #3159d9 50%, #167f91 135%)',
        boxShadow: '0 24px 64px rgba(32,60,150,.22)',
      }}
    >
      <CardContent
        sx={{
          p: { xs: 2.5, sm: 4, md: 5 },
          '&:last-child': { pb: { xs: 2.5, sm: 4, md: 5 } },
        }}
      >
        <Typography
          variant="overline"
          sx={{ opacity: 0.76, letterSpacing: '.14em', fontWeight: 800 }}
        >
          {t('amount')}
        </Typography>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={{ xs: 3, md: 4 }}
          mt={0.5}
        >
          <TextField
            fullWidth
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={invalid}
            helperText={invalid ? t('invalidAmount') : ' '}
            placeholder="0"
            inputProps={{ inputMode: 'decimal', 'aria-label': t('amount') }}
            InputProps={{
              endAdornment: amount ? (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setAmount('')}
                    aria-label={t('clear')}
                  >
                    <CloseRounded />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
            sx={{
              flex: { md: 1.25 },
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,.10)',
                color: 'white',
                fontSize: { xs: '2.6rem', sm: '3.7rem' },
                fontWeight: 750,
                letterSpacing: '-.04em',
                borderRadius: 3,
                '& fieldset': { borderColor: 'rgba(255,255,255,.22)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,.5)' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
              },
              '& .MuiIconButton-root': { color: 'rgba(255,255,255,.8)' },
              '& .MuiFormHelperText-root': {
                color: invalid ? '#ffd3d3' : 'transparent',
              },
            }}
          />
          <Box sx={{ flex: 1, width: '100%' }}>
            <Typography
              variant="overline"
              sx={{ opacity: 0.76, letterSpacing: '.14em', fontWeight: 800 }}
            >
              {t('from')}
            </Typography>
            <Stack direction="row" gap={1} mt={0.5}>
              <Autocomplete
                fullWidth
                disableClearable
                value={base}
                options={codes}
                onChange={(_, value) => setBase(value)}
                getOptionLabel={(code) =>
                  `${assetCode(code, payload)} — ${currencyName(locale, code, payload)}`
                }
                renderOption={(props, code) => {
                  const { key, ...optionProps } = props;
                  return (
                    <Box
                      component="li"
                      key={key}
                      {...optionProps}
                      sx={{ gap: 1.5 }}
                    >
                      <CurrencyAvatar code={code} payload={payload} size={30} />
                      <Box>
                        <b>{assetCode(code, payload)}</b>
                        <Typography
                          variant="caption"
                          display="block"
                          color="text.secondary"
                        >
                          {currencyName(locale, code, payload)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputProps={{
                      ...params.inputProps,
                      'aria-label': t('from'),
                    }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <CurrencyAvatar
                            code={base}
                            payload={payload}
                            size={32}
                          />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    minHeight: 58,
                    borderRadius: 3,
                  },
                }}
              />
              <Button
                variant="contained"
                color="inherit"
                aria-label={t('swap')}
                onClick={onSwap}
                disabled={!codes.length || !canSwap}
                sx={{
                  minWidth: 58,
                  px: 1,
                  bgcolor: 'rgba(255,255,255,.16)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(255,255,255,.25)' },
                }}
              >
                <SwapVertRounded />
              </Button>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
