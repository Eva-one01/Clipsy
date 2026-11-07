import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { DeleteButton, FieldLabel } from '@/components/formBits';
import { FormGroup, FormRow, FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { Chip, IconButton, Toggle } from '@/components/ui';
import { categoriesFor, categoryLabel } from '@/constants/finance';
import { useT } from '@/i18n/useT';
import { formatMoney, parseAmount } from '@/lib/money';
import { ensurePermission } from '@/lib/notifications';
import { useStore } from '@/store';
import type { TxType } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type as typeScale } from '@/theme/tokens';

/** Gasto o ingreso fijo: se registra solo cada mes el día indicado. */
export default function RecurringForm() {
  const { c, isDark } = useTheme();
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => (id ? s.recurring.find((x) => x.id === id) : undefined));
  const currency = useStore((s) => s.settings.currency);
  const add = useStore((s) => s.addRecurring);
  const update = useStore((s) => s.updateRecurring);
  const del = useStore((s) => s.deleteRecurring);

  const [type, setType] = useState<TxType>(existing?.type ?? 'expense');
  const [amountText, setAmountText] = useState(existing ? String(existing.amount) : '');
  const [category, setCategory] = useState(existing?.category ?? (existing?.type === 'income' ? 'salary' : 'subscriptions'));
  const [note, setNote] = useState(existing?.note ?? '');
  const [day, setDay] = useState(existing?.day ?? new Date().getDate());
  const [active, setActive] = useState(existing?.active ?? true);
  const [remind, setRemind] = useState(existing?.remind ?? true);

  const amount = parseAmount(amountText);
  const valid = Number.isFinite(amount) && amount > 0;
  const cats = categoriesFor(type);

  const switchType = (next: TxType) => {
    setType(next);
    if (!categoriesFor(next).some((x) => x.key === category)) setCategory(categoriesFor(next)[0].key);
  };

  const save = async () => {
    if (remind) await ensurePermission();
    const payload = { type, amount, category, note: note.trim(), day, active, remind };
    if (existing) await update(existing.id, payload);
    else {
      // Si el día de este mes ya pasó, no se registra con efecto retroactivo: empieza el mes que viene.
      const now = new Date();
      const lastPosted = day < now.getDate() ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` : null;
      await add({ ...payload, lastPosted });
    }
  };

  return (
    <FormScreen
      title={existing ? t('rec.edit') : t('rec.new')}
      canSave={valid}
      onSave={save}
      footer={existing ? <DeleteButton label={t('rec.delete')} confirm={t('rec.deleteBody')} onDelete={() => del(existing.id)} /> : null}
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
          style={[typeScale.numeric, { fontSize: 52, lineHeight: 60, color: type === 'income' ? c.success : c.text, textAlign: 'center', minWidth: 160, fontVariant: ['tabular-nums'] }]}
        />
        <Text variant="caption" tone="faint">
          {valid ? t('rec.perMonth', { x: formatMoney(amount, currency) }) : currency}
        </Text>
      </View>

      <Input label={t('rec.name')} placeholder={type === 'income' ? t('rec.namePhIncome') : t('rec.namePhExpense')} value={note} onChangeText={setNote} />

      <View>
        <FieldLabel>{t('tx.category')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cats.map((cat) => (
            <Chip key={cat.key} label={categoryLabel(cat.key)} icon={cat.icon} selected={category === cat.key} onPress={() => setCategory(cat.key)} />
          ))}
        </View>
      </View>

      <FormGroup>
        <FormRow label={t('rec.day')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <IconButton icon="minus" size={30} label={t('ev.less')} onPress={() => setDay((d) => (d <= 1 ? 31 : d - 1))} />
            <Text variant="bodyStrong" tabular style={{ minWidth: 26, textAlign: 'center' }}>
              {day}
            </Text>
            <IconButton icon="plus" size={30} label={t('ev.more')} onPress={() => setDay((d) => (d >= 31 ? 1 : d + 1))} />
          </View>
        </FormRow>
        <FormRow label={t('rec.remind')}>
          <Toggle value={remind} onChange={setRemind} label={t('rec.remind')} />
        </FormRow>
        <FormRow label={t('rec.active')} last>
          <Toggle value={active} onChange={setActive} label={t('rec.active')} />
        </FormRow>
      </FormGroup>
      <Text variant="caption" tone="faint">
        {day > 28 ? t('rec.shortMonths') : t('rec.howItWorks')}
      </Text>
    </FormScreen>
  );
}
