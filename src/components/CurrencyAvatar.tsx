import { Avatar } from '@mui/material';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import type { RatesPayload } from '../domain/types';
import { flagUrl } from '../domain/currencyCountry';

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
  const src = crypto || flagUrl(code);
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
