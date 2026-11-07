import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DateTimeField } from '@/components/DateTimeField';
import { ColorPicker, DeleteButton, FieldLabel } from '@/components/formBits';
import { FormGroup, FormRow, FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { Chip, ProgressBar, Toggle } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { addDays, fromKey, toKey } from '@/lib/date';
import { useStore } from '@/store';
import { space, tagColors } from '@/theme/tokens';

const steps = [0, 10, 25, 50, 75, 90, 100];

export default function GoalForm() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => (id ? s.goals.find((g) => g.id === id) : undefined));
  const addGoal = useStore((s) => s.addGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [why, setWhy] = useState(existing?.why ?? '');
  const [progress, setProgress] = useState(existing?.progress ?? 0);
  const [hasDeadline, setHasDeadline] = useState(!!existing?.deadline);
  const [deadline, setDeadline] = useState(existing?.deadline ?? toKey(addDays(new Date(), 30)));
  const [color, setColor] = useState(existing?.color ?? tagColors[1]);

  const save = () => {
    const payload = { title: title.trim(), why: why.trim(), progress, deadline: hasDeadline ? deadline : null, color };
    if (existing) updateGoal(existing.id, payload);
    else addGoal(payload);
  };

  return (
    <FormScreen
      title={existing ? t('goal.edit') : t('goal.new')}
      canSave={title.trim().length > 0}
      onSave={save}
      footer={existing ? <DeleteButton label={t('goal.delete')} confirm={t('goal.deleteBody')} onDelete={() => deleteGoal(existing.id)} /> : null}
    >
      <Input large placeholder={t('goal.placeholder')} value={title} onChangeText={setTitle} autoFocus={!existing} accessibilityLabel={t('goal.placeholder')} />
      <Input label={t('goal.why')} placeholder={t('goal.whyPh')} value={why} onChangeText={setWhy} />

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <FieldLabel>{t('goal.progress')}</FieldLabel>
          <Text variant="caption" tabular style={{ fontWeight: '700' }}>
            {progress}%
          </Text>
        </View>
        <ProgressBar value={progress / 100} color={color} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.sm }}>
          {steps.map((p) => (
            <Chip key={p} label={`${p}%`} selected={progress === p} onPress={() => setProgress(p)} />
          ))}
        </View>
      </View>

      <FormGroup>
        <FormRow label={t('goal.deadline')} last={!hasDeadline}>
          <Toggle value={hasDeadline} onChange={setHasDeadline} label={t('goal.deadline')} />
        </FormRow>
        {hasDeadline && (
          <Animated.View entering={FadeIn}>
            <FormRow label={t('goal.for')} last>
              <DateTimeField mode="date" label={t('goal.deadline')} value={fromKey(deadline)} onChange={(d) => setDeadline(toKey(d))} />
            </FormRow>
          </Animated.View>
        )}
      </FormGroup>

      <View>
        <FieldLabel>{t('form.color')}</FieldLabel>
        <ColorPicker value={color} onChange={setColor} />
      </View>
    </FormScreen>
  );
}
