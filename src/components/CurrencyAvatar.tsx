import { Avatar } from '@mui/material';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import type { RatesPayload } from '../domain/types';
import { flagUrl } from '../domain/currencyCountry';
import { assetCode } from '../domain/currency';

export function CurrencyAvatar({
  code,
  payload,
  size = 42,
}: {
  code: string;
  payload?: RatesPayload | null;
  size?: number;
}) {
  const crypto = payload?.cryptoMeta[code]?.image;
  const src = crypto || flagUrl(assetCode(code, payload));
  return (
    <Avatar
      src={src}
      alt=""
      sx={{
        width: size,
        height: size,
        bgcolor: 'action.hover',
        color: 'text.secondary',
        '& img': { objectFit: crypto ? 'cover' : 'cover' },
      }}
    >
      <PaymentsRounded fontSize={size < 36 ? 'small' : 'medium'} />
    </Avatar>
  );
}
