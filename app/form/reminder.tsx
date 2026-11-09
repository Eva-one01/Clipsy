import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { DateTimeField } from '@/components/DateTimeField';
import { DeleteButton, FieldLabel } from '@/components/formBits';
import { FormGroup, FormRow, FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { Chip } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { ensurePermission } from '@/lib/notifications';
import { useStore } from '@/store';

function inMinutes(m: number) {
  const d = new Date(Date.now() + m * 60_000);
  d.setSeconds(0, 0);
  return d;
}

function tomorrowAt(h: number) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d;
}

export default function ReminderForm() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => (id ? s.reminders.find((r) => r.id === id) : undefined));
  const add = useStore((s) => s.addReminder);
  const update = useStore((s) => s.updateReminder);
  const del = useStore((s) => s.deleteReminder);
  const use24h = useStore((s) => s.settings.use24h);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [at, setAt] = useState<Date>(existing ? new Date(existing.at) : inMinutes(60));

  const past = at.getTime() <= Date.now();

  const setDatePart = (d: Date) => {
    const n = new Date(at);
    n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setAt(n);
  };
  const setTimePart = (d: Date) => {
    const n = new Date(at);
    n.setHours(d.getHours(), d.getMinutes(), 0, 0);
    setAt(n);
  };

  const save = async () => {
    await ensurePermission();
    if (existing) await update(existing.id, { title: title.trim(), at: at.getTime(), done: false });
    else await add({ title: title.trim(), at: at.getTime() });
  };

  return (
    <FormScreen
      title={existing ? t('rem.edit') : t('rem.new')}
      canSave={title.trim().length > 0 && !past}
      onSave={save}
      footer={existing ? <DeleteButton label={t('rem.delete')} confirm={t('common.sure')} onDelete={() => del(existing.id)} /> : null}
    >
      <Input large placeholder={t('rem.placeholder')} value={title} onChangeText={setTitle} autoFocus={!existing} accessibilityLabel={t('rem.placeholder')} />

      <View>
        <FieldLabel>{t('rem.quick')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={t('rem.in15')} onPress={() => setAt(inMinutes(15))} />
          <Chip label={t('rem.in1h')} onPress={() => setAt(inMinutes(60))} />
          <Chip label={t('rem.in3h')} onPress={() => setAt(inMinutes(180))} />
          <Chip label={t('rem.tomorrow9')} onPress={() => setAt(tomorrowAt(9))} />
        </View>
      </View>

      <FormGroup>
        <FormRow label={t('rem.day')}>
          <DateTimeField mode="date" label={t('rem.day')} value={at} onChange={setDatePart} minimumDate={new Date()} />
        </FormRow>
        <FormRow label={t('rem.time')} last>
          <DateTimeField mode="time" label={t('rem.time')} value={at} onChange={setTimePart} use24h={use24h} />
        </FormRow>
      </FormGroup>

      {past && (
        <Text variant="caption" tone="danger">
          {t('rem.past')}
        </Text>
      )}
    </FormScreen>
  );
}
