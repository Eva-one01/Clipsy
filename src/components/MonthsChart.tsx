import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';
import { intlLocale } from '@/i18n';
import { useT } from '@/i18n/useT';
import { formatMoney } from '@/lib/money';
import type { Transaction } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Ingresos y gastos de los últimos meses, en barras emparejadas.
 * Tocar un mes lo abre arriba. El mes seleccionado se resalta.
 */
export function MonthsChart({
  transactions,
  month,
  months = 6,
  currency,
  onSelect,
}: {
  transactions: Transaction[];
  month: Date;
  months?: number;
  currency: string;
  onSelect: (d: Date) => void;
}) {
  const { c } = useTheme();
  const { t } = useT();

  const data = useMemo(() => {
    const out: { d: Date; key: string; income: number; expense: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(month.getFullYear(), month.getMonth() - i, 1);
      out.push({ d, key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, income: 0, expense: 0 });
    }
    const idx = new Map(out.map((m, i) => [m.key, i]));
    for (const x of transactions) {
      const i = idx.get(x.date.slice(0, 7));
      if (i === undefined) continue;
      if (x.type === 'income') out[i].income += x.amount;
      else out[i].expense += x.amount;
    }
    return out;
  }, [transactions, month, months]);

  const max = Math.max(1, ...data.map((m) => Math.max(m.income, m.expense)));
  const H = 120;
  const selKey = `${month.getFullYear()}-${pad(month.getMonth() + 1)}`;
  const fmt = new Intl.DateTimeFormat(intlLocale(), { month: 'short' });
  const avg = data.reduce((s, m) => s + m.expense, 0) / data.length;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <Legend color={c.success} label={t('fin.income')} />
        <Legend color={c.accent} label={t('fin.expenses')} />
        <Text variant="caption" tone="faint" style={{ marginLeft: 'auto' }} numberOfLines={1}>
          {t('fin.avgSpend', { x: formatMoney(avg, currency, { compact: true }) })}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H + 22 }}>
        {data.map((m, i) => {
          const sel = m.key === selKey;
          const hi = Math.max(m.income ? 3 : 0, (m.income / max) * H);
          const he = Math.max(m.expense ? 3 : 0, (m.expense / max) * H);
          return (
            <PressableScale
              key={m.key}
              onPress={() => onSelect(m.d)}
              scaleTo={0.95}
              accessibilityRole="button"
              accessibilityLabel={`${fmt.format(m.d)}: ${t('fin.income')} ${formatMoney(m.income, currency)}, ${t('fin.expenses')} ${formatMoney(m.expense, currency)}`}
              style={{ flex: 1, alignItems: 'center', gap: 6 }}
            >
              <Animated.View entering={FadeIn.delay(i * 50).duration(motion.slow)}>
                <Svg width={30} height={H}>
                  <Line x1={0} x2={30} y1={H - 0.5} y2={H - 0.5} stroke={c.border} strokeWidth={1} />
                  <Rect x={3} y={H - hi} width={11} height={hi} rx={3} fill={c.success} opacity={sel ? 1 : 0.55} />
                  <Rect x={16} y={H - he} width={11} height={he} rx={3} fill={c.accent} opacity={sel ? 1 : 0.55} />
                </Svg>
              </Animated.View>
              <Text variant="caption" tone={sel ? 'default' : 'faint'} style={{ fontWeight: sel ? '700' : '400' }}>
                {fmt.format(m.d).replace('.', '')}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
