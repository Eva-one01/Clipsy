import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { DonutChart } from '@/components/DonutChart';
import { MonthsChart } from '@/components/MonthsChart';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Divider, EmptyState, Icon, IconButton, ProgressBar, SectionHeader } from '@/components/ui';
import { categoryLabel, expenseCategories, findCategory } from '@/constants/finance';
import { useT } from '@/i18n/useT';
import { addMonths, formatMonthTitle, fromKey, relativeDay } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { nextCharges } from '@/lib/recurrence';
import { useStore } from '@/store';
import type { RecurringTx, Transaction } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { chartColors, motion, radius, space } from '@/theme/tokens';

export default function Finance() {
  const { c, scheme } = useTheme();
  const { t } = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const txs = useStore((s) => s.transactions);
  const currency = useStore((s) => s.settings.currency);
  const budget = useStore((s) => s.settings.monthlyBudget);
  const limits = useStore((s) => s.settings.categoryBudgets);
  const recurring = useStore((s) => s.recurring);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = useMemo(
    () => txs.filter((x) => x.date.startsWith(prefix)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [txs, prefix],
  );

  const income = monthTx.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
  const expense = monthTx.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);

  // Gasto por categoría. Las 7 primeras categorías tienen color fijo; el resto se agrupa en "Otros".
  const byCategory = useMemo(() => {
    const palette = chartColors[scheme];
    const m = new Map<string, number>();
    monthTx
      .filter((x) => x.type === 'expense')
      .forEach((x) => {
        const idx = expenseCategories.findIndex((k) => k.key === x.category);
        const key = idx >= 0 && idx < palette.length ? x.category : 'other';
        m.set(key, (m.get(key) ?? 0) + x.amount);
      });
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, amount]) => {
        const idx = expenseCategories.findIndex((k) => k.key === key);
        return { key, amount, color: key === 'other' ? c.textFaint : palette[idx] };
      });
  }, [monthTx, scheme, c.textFaint]);

  // Base del 100 %: el presupuesto del mes; si no hay, los ingresos; si tampoco, el total gastado.
  // Balance del mes = base fijada en Ajustes + ingresos − gastos.
  const funds = budget + income;
  const balance = funds - expense;
  const base = funds > 0 ? funds : expense;
  const baseLabel = funds > 0 || base === 0 ? t('fin.ofBalance') : t('fin.ofSpent');
  const over = expense > base;
  const scale = Math.max(base, expense) || 1;
  const pctOf = (x: number) => (base > 0 ? Math.round((x / base) * 100) : 0);
  const available = Math.max(0, base - expense);
  const sel = byCategory.find((x) => x.key === selected) ?? null;

  const grouped = useMemo(() => {
    const g: { date: string; items: Transaction[]; total: number }[] = [];
    for (const t of monthTx) {
      let last = g[g.length - 1];
      if (!last || last.date !== t.date) {
        last = { date: t.date, items: [], total: 0 };
        g.push(last);
      }
      last.items.push(t);
      last.total += t.type === 'income' ? t.amount : -t.amount;
    }
    return g;
  }, [monthTx]);

  const limitRows = useMemo(
    () =>
      Object.entries(limits ?? {})
        .filter(([, v]) => v > 0)
        .map(([key, limit]) => ({
          key,
          limit,
          spent: monthTx.filter((x) => x.type === 'expense' && x.category === key).reduce((s, x) => s + x.amount, 0),
        }))
        .sort((a, b) => b.spent / b.limit - a.spent / a.limit),
    [limits, monthTx],
  );
  const fixedIncome = recurring.filter((r) => r.active && r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const fixedExpense = recurring.filter((r) => r.active && r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const budgetRatio = funds > 0 ? expense / funds : 0;
  const budgetColor = budgetRatio >= 1 ? c.danger : budgetRatio >= 0.8 ? c.warning : c.accent;

  const shift = (n: number) => {
    setSelected(null);
    setMonth((m) => addMonths(m, n));
  };

  return (
    <Screen
      tabbed
      title={t('fin.title')}
      subtitle={formatMonthTitle(month)}
      actions={
        <>
          <IconButton icon="chevron-left" label={t('common.prevMonth')} onPress={() => shift(-1)} />
          <IconButton icon="chevron-right" label={t('common.nextMonth')} onPress={() => shift(1)} />
          <IconButton icon="plus" label={t('fin.new')} variant="accent" onPress={() => router.push('/form/transaction')} />
        </>
      }
    >
      <Animated.View key={prefix} entering={FadeInDown.duration(motion.slow)}>
        <Card style={{ gap: space.lg }}>
          {/* El balance del mes es el que el usuario fija en Ajustes; ingresos y gastos van aparte. */}
          <PressableScale
            onPress={() => router.push('/settings')}
            scaleTo={0.99}
            accessibilityRole="button"
            accessibilityHint={t('fin.balanceHint', { x: formatMoney(budget, currency) })}
            style={{ alignSelf: 'flex-start', maxWidth: '100%' }}
          >
            <Text variant="label" tone="faint" upper>
              {t('fin.balance')}
            </Text>
            <Text
              variant="numeric"
              tabular
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ marginTop: 4, color: balance < 0 ? c.danger : funds > 0 || expense > 0 ? c.text : c.textFaint }}
            >
              {funds > 0 || expense > 0 ? formatMoney(balance, currency) : '—'}
            </Text>
            <Text variant="caption" tone="faint" style={{ marginTop: 2 }}>
              {budget > 0 ? t('fin.balanceHint', { x: formatMoney(budget, currency) }) : t('fin.setBudget')}
            </Text>
          </PressableScale>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Stat label={t('fin.income')} value={formatMoney(income, currency)} icon="arrow-down-left" color={c.success} />
            <Stat label={t('fin.expenses')} value={formatMoney(expense, currency)} icon="arrow-up-right" color={c.danger} />
          </View>
          {funds > 0 && (
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" tone="muted">
                  {t('fin.budget')}
                </Text>
                <Text variant="caption" tabular style={{ color: budgetColor }}>
                  {formatMoney(expense, currency, { compact: true })} / {formatMoney(funds, currency, { compact: true })}
                </Text>
              </View>
              <ProgressBar value={budgetRatio} color={budgetColor} />
              <Text variant="caption" tone="faint">
                {budgetRatio >= 1
                  ? t('fin.over', { x: formatMoney(-balance, currency) })
                  : t('fin.left', { x: formatMoney(balance, currency) })}
              </Text>
            </View>
          )}
        </Card>
      </Animated.View>


      {(
        <>
          <SectionHeader title={t('fin.where')} />
          <Animated.View key={`chart-${prefix}`} entering={FadeInDown.delay(80).duration(motion.slow)}>
            <Card style={{ gap: space.lg }}>
              <View style={{ alignItems: 'center', paddingTop: space.sm }}>
                <DonutChart
                  animationKey={prefix}
                  selected={selected}
                  slices={byCategory.map((x) => ({ key: x.key, value: x.amount / scale, color: x.color }))}
                  accessibilityLabel={`${t('fin.chartTitle')}: ${byCategory
                    .map((x) => `${categoryLabel(x.key)} ${pctOf(x.amount)}%`)
                    .join(', ')}. ${t('fin.available')} ${formatMoney(available, currency)}`}
                >
                  <View style={{ alignItems: 'center', maxWidth: 120 }}>
                    <Text variant="numeric" tabular style={{ fontSize: 30, lineHeight: 34, color: over && !sel ? c.danger : c.text }}>
                      {pctOf(sel ? sel.amount : expense)}%
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {sel ? categoryLabel(sel.key) : t('fin.spent')}
                    </Text>
                    <Text variant="caption" tone="faint" numberOfLines={1}>
                      {baseLabel}
                    </Text>
                  </View>
                </DonutChart>
              </View>

              <View style={{ gap: 2 }}>
                {byCategory.map((x) => {
                  const cat = findCategory(x.key);
                  const active = selected === x.key;
                  return (
                    <PressableScale
                      key={x.key}
                      scaleTo={0.985}
                      onPress={() => {
                        setSelected(active ? null : x.key);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.legendRow, { backgroundColor: active ? c.surfaceAlt : 'transparent', opacity: selected && !active ? 0.55 : 1 }]}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: x.color }} />
                      <Icon name={cat.icon} size={14} color={c.textMuted} />
                      <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                        {categoryLabel(x.key)}
                      </Text>
                      <Text variant="caption" tone="muted" tabular>
                        {formatMoney(x.amount, currency)}
                      </Text>
                      <Text variant="caption" tabular style={{ width: 44, textAlign: 'right', fontWeight: '600' }}>
                        {pctOf(x.amount)}%
                      </Text>
                    </PressableScale>
                  );
                })}
                {byCategory.length === 0 && (
                  <Text variant="caption" tone="muted" align="center" style={{ marginBottom: space.xs }}>
                    {t('fin.noSpend')}
                  </Text>
                )}
                {available > 0 && (
                  <View style={styles.legendRow}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.borderStrong }} />
                    <Icon name="check-circle" size={14} color={c.textMuted} />
                    <Text variant="caption" style={{ flex: 1 }}>
                      {t('fin.available')}
                    </Text>
                    <Text variant="caption" tone="muted" tabular>
                      {formatMoney(available, currency)}
                    </Text>
                    <Text variant="caption" tabular style={{ width: 44, textAlign: 'right', fontWeight: '600' }}>
                      {pctOf(available)}%
                    </Text>
                  </View>
                )}
              </View>

              {over && base > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Icon name="alert-triangle" size={14} color={funds > 0 ? c.danger : c.warning} />
                  <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                    {funds > 0 ? t('fin.over', { x: formatMoney(expense - base, currency) }) : t('fin.overBase', { x: formatMoney(expense - base, currency) })}
                  </Text>
                </View>
              )}
            </Card>
          </Animated.View>
        </>
      )}

      <SectionHeader title={t('bud.section')} action={t('common.edit')} onAction={() => router.push('/form/budgets')} />
      <Card style={{ gap: space.md }}>
        {limitRows.length === 0 ? (
          <PressableScale onPress={() => router.push('/form/budgets')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name="sliders" size={16} color={c.textMuted} />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              {t('bud.empty')}
            </Text>
            <Icon name="chevron-right" size={16} color={c.textFaint} />
          </PressableScale>
        ) : (
          limitRows.map((r) => {
            const ratio = r.spent / r.limit;
            const col = ratio >= 1 ? c.danger : ratio >= 0.8 ? c.warning : c.accent;
            return (
              <View key={r.key} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Icon name={findCategory(r.key).icon} size={14} color={c.textMuted} />
                  <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                    {categoryLabel(r.key)}
                  </Text>
                  <Text variant="caption" tabular style={{ color: ratio >= 0.8 ? col : c.textMuted }}>
                    {formatMoney(r.spent, currency, { compact: true })} / {formatMoney(r.limit, currency, { compact: true })}
                  </Text>
                </View>
                <ProgressBar value={Math.min(1, ratio)} color={col} height={5} />
              </View>
            );
          })
        )}
      </Card>

      <SectionHeader title={t('rec.section')} action={t('rec.add')} onAction={() => router.push('/form/recurring')} />
      <Card padded={false}>
        {recurring.length === 0 ? (
          <PressableScale onPress={() => router.push('/form/recurring')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg }}>
            <Icon name="repeat" size={16} color={c.textMuted} />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              {t('rec.empty')}
            </Text>
            <Icon name="chevron-right" size={16} color={c.textFaint} />
          </PressableScale>
        ) : (
          recurring.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Divider inset={58} />}
              <RecurringRow r={r} currency={currency} />
            </View>
          ))
        )}
      </Card>
      {recurring.length > 0 && (
        <Text variant="caption" tone="faint" style={{ marginTop: space.sm }}>
          {t('rec.totals', { i: formatMoney(fixedIncome, currency), e: formatMoney(fixedExpense, currency) })}
        </Text>
      )}

      <SectionHeader title={t('fin.trend')} />
      <Card>
        <MonthsChart
          transactions={txs}
          month={month}
          currency={currency}
          onSelect={(d) => {
            setSelected(null);
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
          }}
        />
      </Card>

      <SectionHeader title={t('fin.movements')} />
      {grouped.length === 0 ? (
        <EmptyState
          icon="credit-card"
          title={t('fin.emptyTitle')}
          subtitle={t('fin.emptyBody')}
          action={t('fin.record')}
          onAction={() => router.push('/form/transaction')}
        />
      ) : (
        grouped.map((g, gi) => (
          <Animated.View key={g.date} entering={FadeInDown.delay(Math.min(gi, 6) * 40)} layout={LinearTransition} style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.xs }}>
              <Text variant="caption" tone="muted">
                {relativeDay(g.date)} · {fromKey(g.date).getDate()}
              </Text>
              <Text variant="caption" tone="faint" tabular>
                {formatMoney(g.total, currency, { sign: true })}
              </Text>
            </View>
            <Card padded={false}>
              {g.items.map((x, i) => (
                <View key={x.id}>
                  {i > 0 && <Divider inset={58} />}
                  <TxRow tx={x} currency={currency} />
                </View>
              ))}
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: string; icon: 'arrow-down-left' | 'arrow-up-right'; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name={icon} size={14} color={color} />
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      </View>
      <Text variant="bodyStrong" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function TxRow({ tx, currency }: { tx: Transaction; currency: string }) {
  const { c } = useTheme();
  const { t } = useT();
  const cat = findCategory(tx.category);
  const label = categoryLabel(cat.key);
  const isIncome = tx.type === 'income';
  return (
    <PressableScale
      scaleTo={0.985}
      onPress={() => router.push({ pathname: '/form/transaction', params: { id: tx.id } })}
      accessibilityLabel={`${label}, ${isIncome ? t('fin.incomeOne') : t('fin.expenseOne')}: ${formatMoney(tx.amount, currency)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}
    >
      <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: isIncome ? c.successSoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={cat.icon} size={16} color={isIncome ? c.success : c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1}>
          {tx.note || label}
        </Text>
        {tx.note ? (
          <Text variant="caption" tone="faint">
            {label}
          </Text>
        ) : null}
      </View>
      <Text variant="bodyStrong" tabular style={{ color: isIncome ? c.success : c.text }}>
        {isIncome ? '+' : '−'}
        {formatMoney(tx.amount, currency)}
      </Text>
    </PressableScale>
  );
}

function RecurringRow({ r, currency }: { r: RecurringTx; currency: string }) {
  const { c } = useTheme();
  const { t } = useT();
  const cat = findCategory(r.category);
  const label = categoryLabel(cat.key);
  const isIncome = r.type === 'income';
  const next = r.active ? nextCharges(r, 1)[0] : undefined;
  const nextLabel = next
    ? t('rec.next', { d: relativeDay(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`) })
    : t('rec.paused');
  return (
    <PressableScale
      scaleTo={0.985}
      onPress={() => router.push({ pathname: '/form/recurring', params: { id: r.id } })}
      accessibilityLabel={`${r.note || label}, ${formatMoney(r.amount, currency)}, ${nextLabel}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, opacity: r.active ? 1 : 0.55 }}
    >
      <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: isIncome ? c.successSoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={cat.icon} size={16} color={isIncome ? c.success : c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1}>
          {r.note || label}
        </Text>
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {t('rec.everyDay', { d: r.day })} · {nextLabel}
        </Text>
      </View>
      <Text variant="bodyStrong" tabular style={{ color: isIncome ? c.success : c.text }}>
        {isIncome ? '+' : '−'}
        {formatMoney(r.amount, currency)}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.sm },
});
