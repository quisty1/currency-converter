import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Card,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import { convert, parseAmount, unitRate } from '../domain/currency';
import type { RatesPayload } from '../domain/types';
import { CurrencyAvatar } from './CurrencyAvatar';
import { currencyName, formatValue, useI18n } from '../i18n/I18nProvider';
import { useSettings } from '../store/settings';

function ResultCard({
  code,
  payload,
  loading,
}: {
  code: string;
  payload?: RatesPayload;
  loading: boolean;
}) {
  const { locale, t } = useI18n();
  const { amount, base } = useSettings();
  const numericAmount = parseAmount(amount);
  const result =
    numericAmount == null ? null : convert(numericAmount, base, code, payload);
  const rate = unitRate(base, code, payload);
  const [copied, setCopied] = useState(false);
  const sortable = useSortable({ id: code });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.55 : 1,
  };
  const copy = async () => {
    if (result == null) return;
    await navigator.clipboard.writeText(String(result));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <Card
      ref={sortable.setNodeRef}
      style={style}
      elevation={0}
      sx={{
        border: 1,
        borderColor: sortable.isDragging ? 'primary.main' : 'divider',
        transition: 'border-color .2s, box-shadow .2s',
        '&:hover': {
          borderColor: 'primary.light',
          boxShadow: '0 12px 32px rgba(30,48,90,.08)',
        },
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" alignItems="center" gap={{ xs: 1.5, sm: 2 }}>
          <IconButton
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label={`${t('drag')} ${code}`}
            onClick={(event) => event.stopPropagation()}
            sx={{
              cursor: 'grab',
              ml: -1,
              touchAction: 'none',
              color: 'text.disabled',
            }}
          >
            <DragIndicatorRounded />
          </IconButton>
          <CurrencyAvatar code={code} payload={payload} />
          <Box minWidth={0} flex={1}>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography fontWeight={800}>{code}</Typography>
              {payload?.cryptoMeta[code] && (
                <Chip label="crypto" size="small" variant="outlined" />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" noWrap>
              {currencyName(locale, code, payload)}
            </Typography>
          </Box>
          <Box textAlign="right">
            {loading && !payload ? (
              <Skeleton width={130} height={34} />
            ) : (
              <Typography
                variant="h6"
                fontWeight={750}
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatValue(locale, result, code, payload)}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {rate == null
                ? t('noRate')
                : t('rate', {
                    from: base,
                    value: formatValue(locale, rate, code, payload),
                  })}
            </Typography>
          </Box>
          <Tooltip title={copied ? t('copied') : t('copy')}>
            <IconButton
              aria-label={`${t('copy')} ${code}`}
              onClick={(event) => {
                event.stopPropagation();
                void copy();
              }}
              color={copied ? 'success' : 'default'}
            >
              <ContentCopyRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Card>
  );
}

export function ResultsList({
  payload,
  loading,
}: {
  payload?: RatesPayload;
  loading: boolean;
}) {
  const { targets, base, setTargets } = useSettings();
  const visible = targets.filter((code) => code !== base);
  const sensors = useSensors(
    // A short threshold prevents ordinary clicks from starting a drag operation.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = visible.indexOf(String(active.id));
    const to = visible.indexOf(String(over.id));
    const reordered = arrayMove(visible, from, to);
    // Preserve a hidden base entry when it already exists in the stored order.
    setTargets(targets.includes(base) ? [base, ...reordered] : reordered);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={visible} strategy={verticalListSortingStrategy}>
        <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} gap={1.5}>
          {visible.map((code) => (
            <Box component="li" key={code}>
              <ResultCard code={code} payload={payload} loading={loading} />
            </Box>
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}
