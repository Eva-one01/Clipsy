import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { DateTimeField } from '@/components/DateTimeField';
import { DeleteButton, FieldLabel } from '@/components/formBits';
import { FormGroup, FormRow, FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { Chip, Toggle } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { dateToTime, describeDays, timeToDate, weekdayName } from '@/lib/date';
import { ensurePermission } from '@/lib/notifications';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const dayOrder = [1, 2, 3, 4, 5, 6, 0];

export default function AlarmForm() {
  const { c } = useTheme();
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => (id ? s.alarms.find((a) => a.id === id) : undefined));
  const add = useStore((s) => s.addAlarm);
  const update = useStore((s) => s.updateAlarm);
  const del = useStore((s) => s.deleteAlarm);
  const use24h = useStore((s) => s.settings.use24h);

  const [time, setTime] = useState(existing?.time ?? '07:00');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [days, setDays] = useState<number[]>(existing?.days ?? [1, 2, 3, 4, 5]);
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);

  const toggleDay = (d: number) => {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  };

  const save = async () => {
    await ensurePermission();
    const payload = { time, label: label.trim(), days, enabled };
    if (existing) await update(existing.id, payload);
    else await add(payload);
  };

  const preset = (p: number[]) => {
    setDays(p);
  };
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

  return (
    <FormScreen
      title={existing ? t('alarm.edit') : t('alarm.new')}
      canSave
      onSave={save}
      footer={existing ? <DeleteButton label={t('alarm.delete')} confirm={t('common.sure')} onDelete={() => del(existing.id)} /> : null}
    >
      <View style={{ alignItems: 'center', paddingVertical: space.md }}>
        <DateTimeField mode="time" large label={t('alarm.timeA11y')} value={timeToDate(time)} onChange={(d) => setTime(dateToTime(d))} use24h={use24h} />
      </View>

      <View>
        <FieldLabel>{t('alarm.repeat', { d: describeDays(days) })}</FieldLabel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {dayOrder.map((d) => {
            const sel = days.includes(d);
            return (
              <PressableScale
                key={d}
                onPress={() => toggleDay(d)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={weekdayName(d, 'long')}
                scaleTo={0.88}
                style={{ width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? c.text : c.surfaceAlt }}
              >
                <Text variant="caption" style={{ color: sel ? c.bg : c.textMuted, fontWeight: '700' }}>
                  {weekdayName(d, 'narrow')}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md }}>
          <Chip label={t('days.weekdays')} selected={same(days, [1, 2, 3, 4, 5])} onPress={() => preset([1, 2, 3, 4, 5])} />
          <Chip label={t('days.weekends')} selected={same(days, [0, 6])} onPress={() => preset([0, 6])} />
          <Chip label={t('common.all')} selected={days.length === 0 || days.length === 7} onPress={() => preset([])} />
        </View>
      </View>

      <Input label={t('alarm.label')} placeholder={t('alarm.labelPh')} value={label} onChangeText={setLabel} />

      {existing && (
        <FormGroup>
          <FormRow label={t('alarm.enabled')} last>
            <Toggle value={enabled} onChange={setEnabled} label={t('alarm.enabled')} />
          </FormRow>
        </FormGroup>
      )}

      <Text variant="caption" tone="faint">
        {t('alarm.note')}
      </Text>
    </FormScreen>
  );
}
