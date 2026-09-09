import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
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
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import { assetCode, convert, parseAmount, unitRate } from '../domain/currency';
import type { RatesPayload } from '../domain/types';
import { CurrencyAvatar } from './CurrencyAvatar';
import { currencyName, formatValue, useI18n } from '../i18n/I18nProvider';
import { useSettings } from '../store/settings';

function ResultCard({
  code,
  payload,
  loading,
  onRemove,
  onKeyboardMove,
}: {
  code: string;
  payload?: RatesPayload;
  loading: boolean;
  onRemove: () => void;
  onKeyboardMove: (direction: -1 | 1) => void;
}) {
  const { locale, t } = useI18n();
  const { amount, base } = useSettings();
  const numericAmount = parseAmount(amount);
  const result =
    numericAmount == null ? null : convert(numericAmount, base, code, payload);
  const rate = unitRate(base, code, payload);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const sortable = useSortable({ id: code });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.55 : 1,
  };
  const copy = async () => {
    if (result == null) return;
    try {
      await navigator.clipboard.writeText(
        formatValue(locale, result, code, payload),
      );
      setCopyError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      setCopyError(true);
      window.setTimeout(() => setCopyError(false), 2400);
    }
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
      <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '44px 60px minmax(0, 1fr) 44px 44px',
              sm: '40px 42px minmax(110px, 1fr) minmax(0, auto) 40px 40px',
            },
            gridTemplateRows: { xs: 'auto auto', sm: 'auto' },
            columnGap: { xs: 1, sm: 2 },
            rowGap: { xs: 0.75, sm: 0 },
            alignItems: 'center',
          }}
        >
          <IconButton
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label={`${t('drag')} ${assetCode(code, payload)}`}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (
                event.altKey &&
                (event.key === 'ArrowUp' || event.key === 'ArrowDown')
              ) {
                event.preventDefault();
                onKeyboardMove(event.key === 'ArrowUp' ? -1 : 1);
              }
            }}
            sx={{
              cursor: 'grab',
              touchAction: 'none',
              color: 'text.disabled',
              minWidth: 44,
              minHeight: 44,
              p: 1,
              gridColumn: 1,
              gridRow: { xs: '1 / span 2', sm: 1 },
            }}
          >
            <DragIndicatorRounded />
          </IconButton>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gridColumn: 2,
              gridRow: 1,
            }}
          >
            <CurrencyAvatar code={code} payload={payload} />
          </Box>
          <Box
            sx={{
              minWidth: 0,
              textAlign: { xs: 'center', sm: 'left' },
              gridColumn: { xs: 2, sm: 3 },
              gridRow: { xs: 2, sm: 1 },
            }}
          >
            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              justifyContent={{ xs: 'center', sm: 'flex-start' }}
            >
              <Typography fontWeight={800}>
                {assetCode(code, payload)}
              </Typography>
              {payload?.cryptoMeta[code] && (
                <Chip
                  label="crypto"
                  size="small"
                  variant="outlined"
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                />
              )}
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
            >
              {currencyName(locale, code, payload)}
            </Typography>
          </Box>
          <Box
            sx={{
              minWidth: 0,
              textAlign: 'right',
              gridColumn: { xs: '3 / 6', sm: 4 },
              gridRow: { xs: 2, sm: 1 },
            }}
          >
            {loading && !payload ? (
              <Skeleton width={130} height={34} />
            ) : (
              <Typography
                variant="h6"
                component="div"
                fontWeight={750}
                sx={{
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: {
                    xs: 'clamp(1rem, 4.8vw, 1.25rem)',
                    sm: '1.25rem',
                  },
                  lineHeight: 1.25,
                  overflowWrap: 'anywhere',
                }}
              >
                {formatValue(locale, result, code, payload)}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {rate == null
                ? t('noRate')
                : t('rate', {
                    from: assetCode(base, payload),
                    value: formatValue(locale, rate, code, payload),
                  })}
            </Typography>
          </Box>
          <Tooltip
            title={
              copyError ? t('copyFailed') : copied ? t('copied') : t('copy')
            }
          >
            <IconButton
              aria-label={`${t('copy')} ${assetCode(code, payload)}`}
              onClick={(event) => {
                event.stopPropagation();
                void copy();
              }}
              color={copied ? 'success' : 'default'}
              sx={{
                minWidth: 44,
                minHeight: 44,
                p: 1,
                gridColumn: { xs: 4, sm: 5 },
                gridRow: 1,
              }}
            >
              <ContentCopyRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('remove')}>
            <IconButton
              aria-label={`${t('remove')} ${assetCode(code, payload)}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              sx={{
                minWidth: 44,
                minHeight: 44,
                p: 1,
                gridColumn: { xs: 5, sm: 6 },
                gridRow: 1,
              }}
            >
              <DeleteOutlineRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box
            role="status"
            aria-live="polite"
            sx={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              pointerEvents: 'none',
            }}
          >
            {copyError ? t('copyFailed') : copied ? t('copied') : ''}
          </Box>
        </Box>
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
  const reorder = ({ active, over }: DragEndEvent | DragOverEvent) => {
    if (!over || active.id === over.id) return;
    const from = visible.indexOf(String(active.id));
    const to = visible.indexOf(String(over.id));
    const reordered = arrayMove(visible, from, to);
    // Preserve a hidden base entry when it already exists in the stored order.
    setTargets(targets.includes(base) ? [base, ...reordered] : reordered);
  };
  const keyboardMove = (code: string, direction: -1 | 1) => {
    const from = visible.indexOf(code);
    const to = Math.max(0, Math.min(visible.length - 1, from + direction));
    if (from === to) return;
    const reordered = arrayMove(visible, from, to);
    setTargets(targets.includes(base) ? [base, ...reordered] : reordered);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={reorder}
      onDragEnd={reorder}
    >
      <SortableContext items={visible} strategy={verticalListSortingStrategy}>
        <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} gap={1.5}>
          {visible.map((code) => (
            <Box component="li" key={code}>
              <ResultCard
                code={code}
                payload={payload}
                loading={loading}
                onRemove={() =>
                  setTargets(targets.filter((target) => target !== code))
                }
                onKeyboardMove={(direction) => keyboardMove(code, direction)}
              />
            </Box>
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}
