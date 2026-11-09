import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { DateTimeField } from '@/components/DateTimeField';
import { DeleteButton, FieldLabel } from '@/components/formBits';
import { FormGroup, FormRow, FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { Chip, Toggle } from '@/components/ui';
import { categoriesFor, categoryLabel } from '@/constants/finance';
import { useT } from '@/i18n/useT';
import { checkBudgetAlert } from '@/lib/budget';
import { fromKey, toKey, todayKey } from '@/lib/date';
import { formatMoney, parseAmount } from '@/lib/money';
import { useStore } from '@/store';
import type { TxType } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type as typeScale } from '@/theme/tokens';

export default function TransactionForm() {
  const { c, isDark } = useTheme();
  const { t } = useT();
  const { id, type: typeParam } = useLocalSearchParams<{ id?: string; type?: TxType }>();
  const existing = useStore((s) => (id ? s.transactions.find((x) => x.id === id) : undefined));
  const currency = useStore((s) => s.settings.currency);
  const add = useStore((s) => s.addTransaction);
  const update = useStore((s) => s.updateTransaction);
  const del = useStore((s) => s.deleteTransaction);
  const addRecurring = useStore((s) => s.addRecurring);

  const [type, setType] = useState<TxType>(existing?.type ?? typeParam ?? 'expense');
  const [amountText, setAmountText] = useState(existing ? String(existing.amount) : '');
  const [category, setCategory] = useState(existing?.category ?? categoriesFor(type)[0].key);
  const [note, setNote] = useState(existing?.note ?? '');
  const [date, setDate] = useState(existing?.date ?? todayKey());
  const [monthly, setMonthly] = useState(false);

  const amount = parseAmount(amountText);
  const valid = Number.isFinite(amount) && amount > 0;
  const cats = categoriesFor(type);

  const switchType = (next: TxType) => {
    setType(next);
    if (!categoriesFor(next).some((x) => x.key === category)) setCategory(categoriesFor(next)[0].key);
  };

  const save = async () => {
    const payload = { type, amount, category, note: note.trim(), date };
    if (existing) update(existing.id, payload);
    else {
      add(payload);
      // «Repetir cada mes»: crea el fijo; este mes ya queda registrado con este movimiento.
      if (monthly) {
        await addRecurring({ type, amount, category, note: note.trim(), day: fromKey(date).getDate(), active: true, remind: true, lastPosted: date.slice(0, 7) });
      }
    }
    if (type === 'expense') checkBudgetAlert(category, date);
  };

  return (
    <FormScreen
      title={existing ? t('tx.edit') : t('tx.new')}
      canSave={valid}
      onSave={save}
      footer={existing ? <DeleteButton label={t('tx.delete')} confirm={t('common.sure')} onDelete={() => del(existing.id)} /> : null}
    >
      <Segmented<TxType>
        value={type}
        onChange={switchType}
        options={[
          { value: 'expense', label: t('tx.expense') },
          { value: 'income', label: t('tx.income') },
        ]}
      />

      <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.md }}>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0"
          placeholderTextColor={c.textFaint}
          keyboardType="decimal-pad"
          autoFocus={!existing}
          selectionColor={c.accent}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          accessibilityLabel={t('tx.amountA11y', { c: currency })}
          maxFontSizeMultiplier={1.2}
          style={[typeScale.numeric, { fontSize: 52, lineHeight: 60, color: type === 'income' ? c.success : c.danger, textAlign: 'center', minWidth: 160, fontVariant: ['tabular-nums'] }]}
        />
        <Text variant="caption" tone="faint">
          {valid ? formatMoney(amount, currency) : currency}
        </Text>
      </View>

      <View>
        <FieldLabel>{t('tx.category')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cats.map((cat) => (
            <Chip key={cat.key} label={categoryLabel(cat.key)} icon={cat.icon} selected={category === cat.key} onPress={() => setCategory(cat.key)} />
          ))}
        </View>
      </View>

      <Input label={t('tx.note')} placeholder={type === 'income' ? t('tx.notePhIncome') : t('tx.notePhExpense')} value={note} onChangeText={setNote} />

      <FormGroup>
        <FormRow label={t('form.date')} last={!!existing}>
          <DateTimeField mode="date" label={t('form.date')} value={fromKey(date)} onChange={(d) => setDate(toKey(d))} />
        </FormRow>
        {!existing && (
          <FormRow label={t('tx.monthly')} last>
            <Toggle value={monthly} onChange={setMonthly} label={t('tx.monthly')} />
          </FormRow>
        )}
      </FormGroup>
      {!existing && monthly ? (
        <Text variant="caption" tone="faint">
          {t('tx.monthlyHint', { d: fromKey(date).getDate() })}
        </Text>
      ) : null}
    </FormScreen>
  );
}
