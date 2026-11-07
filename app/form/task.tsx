import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DateTimeField } from '@/components/DateTimeField';
import { DeleteButton, FieldLabel } from '@/components/formBits';
import { FormGroup, FormRow, FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { Chip } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { addDays, fromKey, toKey, todayKey } from '@/lib/date';
import { useStore } from '@/store';
import type { Priority } from '@/store/types';

type DueMode = 'none' | 'today' | 'tomorrow' | 'custom';

export default function TaskForm() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => (id ? s.tasks.find((x) => x.id === id) : undefined));
  const goals = useStore((s) => s.goals);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const today = todayKey();
  const tomorrow = toKey(addDays(new Date(), 1));
  const initialMode: DueMode = !existing?.due ? 'none' : existing.due === today ? 'today' : existing.due === tomorrow ? 'tomorrow' : 'custom';

  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [mode, setMode] = useState<DueMode>(initialMode);
  const [custom, setCustom] = useState(existing?.due ?? toKey(addDays(new Date(), 2)));
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 0);
  const [goalId, setGoalId] = useState<string | null>(existing?.goalId ?? null);

  const due = mode === 'none' ? null : mode === 'today' ? today : mode === 'tomorrow' ? tomorrow : custom;
  const activeGoals = goals.filter((g) => !g.archived);

  const save = () => {
    const payload = { title: title.trim(), notes: notes.trim(), due, priority, goalId };
    if (existing) updateTask(existing.id, payload);
    else addTask(payload);
  };

  return (
    <FormScreen
      title={existing ? t('task.edit') : t('task.new')}
      canSave={title.trim().length > 0}
      onSave={save}
      footer={existing ? <DeleteButton label={t('task.delete')} confirm={t('common.sure')} onDelete={() => deleteTask(existing.id)} /> : null}
    >
      <Input large placeholder={t('task.placeholder')} value={title} onChangeText={setTitle} autoFocus={!existing} accessibilityLabel={t('form.title')} />

      <View>
        <FieldLabel>{t('form.date')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={t('task.noDate')} selected={mode === 'none'} onPress={() => setMode('none')} />
          <Chip label={t('common.today')} selected={mode === 'today'} onPress={() => setMode('today')} />
          <Chip label={t('common.tomorrow')} selected={mode === 'tomorrow'} onPress={() => setMode('tomorrow')} />
          <Chip label={t('task.choose')} icon="calendar" selected={mode === 'custom'} onPress={() => setMode('custom')} />
        </View>
        {mode === 'custom' && (
          <Animated.View entering={FadeIn} style={{ marginTop: 12 }}>
            <FormGroup>
              <FormRow label={t('task.due')} last>
                <DateTimeField mode="date" label={t('task.due')} value={fromKey(custom)} onChange={(d) => setCustom(toKey(d))} />
              </FormRow>
            </FormGroup>
          </Animated.View>
        )}
      </View>

      <View>
        <FieldLabel>{t('task.priority')}</FieldLabel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('task.p0')} selected={priority === 0} onPress={() => setPriority(0)} />
          <Chip label={t('task.p1')} icon="flag" selected={priority === 1} onPress={() => setPriority(1)} />
          <Chip label={t('task.p2')} icon="flag" selected={priority === 2} onPress={() => setPriority(2)} />
        </View>
      </View>

      {activeGoals.length > 0 && (
        <View>
          <FieldLabel>{t('task.goal')}</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={t('common.none')} selected={goalId === null} onPress={() => setGoalId(null)} />
            {activeGoals.map((g) => (
              <Chip key={g.id} label={g.title} color={g.color} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />
            ))}
          </View>
        </View>
      )}

      <Input label={t('form.notes')} placeholder={t('task.notesPh')} value={notes} onChangeText={setNotes} multiline style={{ minHeight: 88, textAlignVertical: 'top' }} />
    </FormScreen>
  );
}
