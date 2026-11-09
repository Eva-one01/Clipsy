import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Checkbox } from '@/components/Checkbox';
import { PermissionBanner } from '@/components/PermissionBanner';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Divider, EmptyState, IconButton, SectionHeader, Toggle } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { describeDays, formatDateTime, formatTime } from '@/lib/date';
import { useStore } from '@/store';
import type { Alarm } from '@/store/types';
import { space } from '@/theme/tokens';

export default function Alarms() {
  const { t } = useT();
  const alarms = useStore((s) => s.alarms);
  const reminders = useStore((s) => s.reminders);
  const use24h = useStore((s) => s.settings.use24h);

  const upcoming = useMemo(() => reminders.filter((r) => !r.done), [reminders]);
  const done = useMemo(() => reminders.filter((r) => r.done).slice(-10).reverse(), [reminders]);

  return (
    <Screen
      title={t('alarms.title')}
      subtitle={t('alarms.subtitle')}
      leading={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />}
      actions={
        <>
          <IconButton icon="bell" label={t('alarms.newReminder')} variant="filled" onPress={() => router.push('/form/reminder')} />
          <IconButton icon="plus" label={t('alarms.newAlarm')} variant="accent" onPress={() => router.push('/form/alarm')} />
        </>
      }
    >
      <PermissionBanner />

      <SectionHeader title={t('alarms.title')} action={t('common.add')} onAction={() => router.push('/form/alarm')} />
      {alarms.length === 0 ? (
        <EmptyState icon="clock" title={t('alarms.emptyTitle')} subtitle={t('alarms.emptyBody')} />
      ) : (
        <View style={{ gap: space.sm }}>
          {alarms.map((a, i) => (
            <AlarmCard key={a.id} alarm={a} index={i} use24h={use24h} />
          ))}
        </View>
      )}

      <SectionHeader title={t('alarms.reminders')} action={t('common.add')} onAction={() => router.push('/form/reminder')} />
      {upcoming.length === 0 ? (
        <EmptyState icon="bell" title={t('alarms.remEmptyTitle')} subtitle={t('alarms.remEmptyBody')} />
      ) : (
        <Card padded={false}>
          {upcoming.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Divider inset={56} />}
              <ReminderRow id={r.id} title={r.title} at={r.at} done={r.done} use24h={use24h} />
            </View>
          ))}
        </Card>
      )}

      {done.length > 0 && (
        <>
          <SectionHeader title={t('alarms.doneRecently')} />
          <Card padded={false}>
            {done.map((r, i) => (
              <View key={r.id}>
                {i > 0 && <Divider inset={56} />}
                <ReminderRow id={r.id} title={r.title} at={r.at} done={r.done} use24h={use24h} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function AlarmCard({ alarm, index, use24h }: { alarm: Alarm; index: number; use24h: boolean }) {
  const { t } = useT();
  const update = useStore((s) => s.updateAlarm);
  const time = formatTime(alarm.time, use24h);
  return (
    <Animated.View entering={FadeInDown.delay(index * 40)} exiting={FadeOut} layout={LinearTransition.springify().damping(20)}>
      <PressableScale scaleTo={0.985} onPress={() => router.push({ pathname: '/form/alarm', params: { id: alarm.id } })} accessibilityLabel={t('alarms.a11y', { t: time, l: alarm.label || describeDays(alarm.days) })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, opacity: alarm.enabled ? 1 : 0.45 }}>
            <Text variant="numeric" tabular style={{ fontSize: 40 }} numberOfLines={1} adjustsFontSizeToFit>
              {time}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {[alarm.label, describeDays(alarm.days)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Toggle value={alarm.enabled} onChange={(v) => update(alarm.id, { enabled: v })} label={t('alarms.toggle', { t: time })} />
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

function ReminderRow({ id, title, at, done, use24h }: { id: string; title: string; at: number; done: boolean; use24h: boolean }) {
  const { t } = useT();
  const update = useStore((s) => s.updateReminder);
  const past = at < Date.now();
  const when = formatDateTime(at, use24h);
  return (
    <PressableScale
      scaleTo={0.985}
      onPress={() => router.push({ pathname: '/form/reminder', params: { id } })}
      accessibilityLabel={t('alarms.editReminder', { x: title })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}
    >
      <Checkbox checked={done} onToggle={() => update(id, { done: !done })} label={title} />
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={2} tone={done ? 'faint' : 'default'}>
          {title}
        </Text>
        <Text variant="caption" tone={past && !done ? 'danger' : 'muted'}>
          {when}
        </Text>
      </View>
    </PressableScale>
  );
}
