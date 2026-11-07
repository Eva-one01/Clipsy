import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { FormGroup, FormScreen } from '@/components/FormScreen';
import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { categoryLabel, expenseCategories } from '@/constants/finance';
import { useT } from '@/i18n/useT';
import { spentIn } from '@/lib/budget';
import { formatMoney, parseAmount } from '@/lib/money';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { StyleSheet } from 'react-native';

/** Límite mensual por categoría de gasto. Vacío = sin límite. */
export default function BudgetsForm() {
  const { c } = useTheme();
  const { t } = useT();
  const settings = useStore((s) => s.settings);
  const transactions = useStore((s) => s.transactions);
  const setSettings = useStore((s) => s.setSettings);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(settings.categoryBudgets ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const save = () => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseAmount(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    setSettings({ categoryBudgets: out });
  };

  return (
    <FormScreen title={t('bud.title')} canSave onSave={save}>
      <Text variant="body" tone="muted">
        {t('bud.intro')}
      </Text>
      <FormGroup>
        {expenseCategories.map((cat, i) => {
          const spent = spentIn(transactions, month, cat.key);
          return (
            <View
              key={cat.key}
              style={[
                styles.row,
                { borderBottomColor: c.border, borderBottomWidth: i === expenseCategories.length - 1 ? 0 : StyleSheet.hairlineWidth },
              ]}
            >
              <Icon name={cat.icon} size={16} color={c.textMuted} />
              <View style={{ flex: 1 }}>
                <Text variant="body">{categoryLabel(cat.key)}</Text>
                <Text variant="caption" tone="faint">
                  {t('bud.spentThisMonth', { x: formatMoney(spent, settings.currency) })}
                </Text>
              </View>
              <TextInput
                value={values[cat.key] ?? ''}
                onChangeText={(v) => setValues((s) => ({ ...s, [cat.key]: v }))}
                placeholder={t('bud.noLimit')}
                placeholderTextColor={c.textFaint}
                keyboardType="decimal-pad"
                accessibilityLabel={t('bud.limitFor', { c: categoryLabel(cat.key) })}
                selectionColor={c.accent}
                style={[styles.input, { color: c.text, backgroundColor: c.surfaceAlt }]}
              />
            </View>
          );
        })}
      </FormGroup>
      <Text variant="caption" tone="faint">
        {t('bud.alertsNote', { c: settings.currency })}
      </Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  input: { width: 120, height: 40, borderRadius: 10, paddingHorizontal: space.md, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
