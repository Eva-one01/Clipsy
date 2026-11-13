import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { DateTimeField } from '@/components/DateTimeField';
import { ColorPicker, DeleteButton, FieldLabel } from '@/components/formBits';
import { FormGroup, FormRow, FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { Button, Chip, IconButton, Toggle } from '@/components/ui';
import { Text } from '@/components/Text';
import { useT } from '@/i18n/useT';
import { dateToTime, formatLead, fromKey, minutesToTime, repeatLabel, timeToDate, timeToMinutes, toKey, todayKey } from '@/lib/date';
import { showDialog } from '@/lib/dialog';
import { ensurePermission } from '@/lib/notifications';
import { useStore } from '@/store';
import type { Repeat } from '@/store/types';
import { space, tagColors } from '@/theme/tokens';

const leads: (number | null)[] = [null, 0, 5, 15, 30, 60, 1440];
const repeats: Repeat[] = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'monthlyNth', 'monthlyLast', 'yearly'];
/** Repeticiones que admiten «cada N». */
const withInterval: Repeat[] = ['daily', 'weekly', 'monthly', 'monthlyNth', 'monthlyLast', 'yearly'];

function roundedNow() {
  const d = new Date();
  const m = Math.ceil((d.getHours() * 60 + d.getMinutes() + 1) / 30) * 30;
  return Math.min(m, 23 * 60);
}

export default function EventForm() {
  const { t } = useT();
  const { id, date, occ, start: startParam, end: endParam } = useLocalSearchParams<{ id?: string; date?: string; occ?: string; start?: string; end?: string }>();
  const existing = useStore((s) => (id ? s.events.find((e) => e.id === id) : undefined));
  const addEvent = useStore((s) => s.addEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const skipOccurrence = useStore((s) => s.skipOccurrence);
  const use24h = useStore((s) => s.settings.use24h);

  // Al hacer clic en un hueco de la semana llega la hora elegida.
  const startDefault = startParam && /^\d{2}:\d{2}$/.test(startParam) ? timeToMinutes(startParam) : roundedNow();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [day, setDay] = useState(existing?.date ?? date ?? todayKey());
  const [start, setStart] = useState(existing?.start ?? minutesToTime(startDefault));
  // Al arrastrar sobre un hueco de la semana llega también la hora de fin.
  const endDefault = endParam && /^\d{2}:\d{2}$/.test(endParam) && timeToMinutes(endParam) > startDefault ? timeToMinutes(endParam) : Math.min(startDefault + 60, 23 * 60 + 59);
  const [end, setEnd] = useState(existing?.end ?? minutesToTime(endDefault));
  const [allDay, setAllDay] = useState(existing?.allDay ?? false);
  const [repeat, setRepeat] = useState<Repeat>(existing?.repeat ?? 'none');
  const [interval, setIntervalN] = useState(existing?.interval ?? 1);
  const [until, setUntil] = useState<string | null>(existing?.until ?? null);
  const [exceptions, setExceptions] = useState<string[]>(existing?.exceptions ?? []);
  const [remind, setRemind] = useState<number | null>(existing ? existing.remindBefore : 15);
  const [color, setColor] = useState(existing?.color ?? tagColors[0]);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const invalidRange = !allDay && timeToMinutes(end) <= timeToMinutes(start);
  const canSave = title.trim().length > 0 && !invalidRange;

  const onStartChange = (d: Date) => {
    const t = dateToTime(d);
    const dur = Math.max(15, timeToMinutes(end) - timeToMinutes(start));
    setStart(t);
    setEnd(minutesToTime(Math.min(timeToMinutes(t) + dur, 23 * 60 + 59)));
  };

  const save = async () => {
    if (remind !== null) await ensurePermission();
    const rep = repeat !== 'none';
    const payload = {
      title: title.trim(),
      date: day,
      start,
      end,
      allDay,
      repeat,
      interval: rep && withInterval.includes(repeat) ? interval : 1,
      until: rep && until && until >= day ? until : null,
      exceptions: rep ? exceptions : [],
      remindBefore: remind,
      color,
      notes: notes.trim(),
    };
    if (existing) await updateEvent(existing.id, payload);
    else await addEvent(payload);
  };

  return (
    <FormScreen
      title={existing ? t('ev.edit') : t('ev.new')}
      canSave={canSave}
      onSave={save}
      footer={
        existing ? (
          existing.repeat !== 'none' && occ ? (
            // Evento que se repite abierto desde una fecha concreta: borrar solo esa o toda la serie.
            <View style={{ marginTop: space.md }}>
              <Button
                title={t('ev.delete')}
                variant="danger"
                icon="trash-2"
                full
                onPress={() => {
                  showDialog(t('ev.deleteWhich'), t('ev.deleteWhichBody'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('ev.deleteThis'),
                      onPress: async () => {
                        await skipOccurrence(existing.id, occ);
                        if (router.canGoBack()) router.back();
                      },
                    },
                    {
                      text: t('ev.deleteAll'),
                      style: 'destructive',
                      onPress: async () => {
                        await deleteEvent(existing.id);
                        if (router.canGoBack()) router.back();
                      },
                    },
                  ]);
                }}
              />
            </View>
          ) : (
            <DeleteButton label={t('ev.delete')} confirm={repeat !== 'none' ? t('ev.deleteRepeat') : t('common.sure')} onDelete={() => deleteEvent(existing.id)} />
          )
        ) : null
      }
    >
      <Input large placeholder={t('form.title')} value={title} onChangeText={setTitle} autoFocus={!existing} returnKeyType="done" accessibilityLabel={t('form.title')} />

      <FormGroup>
        <FormRow label={t('ev.allDay')}>
          <Toggle value={allDay} onChange={setAllDay} label={t('ev.allDay')} />
        </FormRow>
        <FormRow label={t('form.date')} last={allDay}>
          <DateTimeField mode="date" label={t('form.date')} value={fromKey(day)} onChange={(d) => setDay(toKey(d))} />
        </FormRow>
        {!allDay && (
          <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition}>
            <FormRow label={t('ev.starts')}>
              <DateTimeField mode="time" label={t('ev.startA11y')} value={timeToDate(start)} onChange={onStartChange} use24h={use24h} />
            </FormRow>
            <FormRow label={invalidRange ? t('ev.endsInvalid') : t('ev.ends')} last>
              <DateTimeField mode="time" label={t('ev.endA11y')} value={timeToDate(end)} onChange={(d) => setEnd(dateToTime(d))} use24h={use24h} />
            </FormRow>
          </Animated.View>
        )}
      </FormGroup>

      <View>
        <FieldLabel>{t('ev.repeat')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {repeats.map((r) => (
            <Chip key={r} label={repeatLabel(r, r === 'monthly' || r === 'monthlyNth' || r === 'yearly' ? day : undefined)} selected={repeat === r} onPress={() => setRepeat(r)} />
          ))}
        </View>
        {repeat !== 'none' && (
          <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={{ marginTop: space.md }}>
            <FormGroup>
              {withInterval.includes(repeat) && (
                <FormRow label={t('ev.frequency')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <IconButton icon="minus" size={30} label={t('ev.less')} onPress={() => setIntervalN((n) => Math.max(1, n - 1))} />
                    <Text variant="bodyStrong" tabular style={{ minWidth: 22, textAlign: 'center' }}>
                      {interval}
                    </Text>
                    <IconButton icon="plus" size={30} label={t('ev.more')} onPress={() => setIntervalN((n) => Math.min(99, n + 1))} />
                  </View>
                </FormRow>
              )}
              <FormRow label={t('ev.repEnds')} last={!exceptions.length && until === null}>
                <Toggle value={until !== null} onChange={(v) => setUntil(v ? toKey(new Date(fromKey(day).getTime() + 30 * 86_400_000)) : null)} label={t('ev.hasEnd')} />
              </FormRow>
              {until !== null && (
                <FormRow label={t('ev.until')} last={!exceptions.length}>
                  <DateTimeField mode="date" label={t('ev.until')} value={fromKey(until)} onChange={(d) => setUntil(toKey(d))} />
                </FormRow>
              )}
              {exceptions.length > 0 && (
                <FormRow label={t('ev.skipped', { n: exceptions.length })} last>
                  <Chip label={t('ev.restore')} icon="rotate-ccw" selected={false} onPress={() => setExceptions([])} />
                </FormRow>
              )}
            </FormGroup>
            <Text variant="caption" tone="faint" style={{ marginTop: space.sm }}>
              {repeatLabel(repeat, day, withInterval.includes(repeat) ? interval : 1)}
            </Text>
          </Animated.View>
        )}
      </View>

      <View>
        <FieldLabel>{t('ev.remind')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {leads.map((l) => (
            <Chip
              key={String(l)}
              label={l === null ? t('ev.noRemind') : l === 0 ? t('ev.atTime') : t('ev.before', { x: formatLead(l) })}
              selected={remind === l}
              onPress={() => setRemind(l)}
              icon={l === null ? 'bell-off' : undefined}
            />
          ))}
        </View>
      </View>

      <View>
        <FieldLabel>{t('form.color')}</FieldLabel>
        <ColorPicker value={color} onChange={setColor} />
      </View>

      <Input label={t('form.notes')} placeholder={t('ev.notesPh')} value={notes} onChangeText={setNotes} multiline style={{ minHeight: 88, textAlignVertical: 'top' }} />
    </FormScreen>
  );
}
