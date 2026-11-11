import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Divider, Icon, IconButton, ProgressBar, SectionHeader } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { addDays, diffDays, eventsOn, formatShortDate, fromKey, relativeDay, toKey, todayKey } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/store';
import type { Task } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

/**
 * Revisión semanal: lo hecho en los últimos 7 días, lo que quedó pendiente (con acciones rápidas),
 * metas, lo que viene la próxima semana y el gasto comparado con la semana anterior.
 */
export default function Review() {
  const { c } = useTheme();
  const { t } = useT();
  const tasks = useStore((s) => s.tasks);
  const events = useStore((s) => s.events);
  const goals = useStore((s) => s.goals);
  const ideas = useStore((s) => s.ideas);
  const txs = useStore((s) => s.transactions);
  const currency = useStore((s) => s.settings.currency);
  const lastReview = useStore((s) => s.settings.lastReview);
  const updateGoal = useStore((s) => s.updateGoal);
  const setSettings = useStore((s) => s.setSettings);

  const today = todayKey();
  const weekAgo = Date.now() - 7 * 86_400_000;

  const done = useMemo(() => tasks.filter((x) => x.done && x.doneAt && x.doneAt >= weekAgo), [tasks, weekAgo]);
  const overdue = useMemo(
    () => tasks.filter((x) => !x.done && x.due && diffDays(x.due, today) < 0).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')),
    [tasks, today],
  );
  const undated = useMemo(() => tasks.filter((x) => !x.done && !x.due).length, [tasks]);

  const days = (from: number, n: number) => Array.from({ length: n }, (_, i) => toKey(addDays(new Date(), from + i)));
  const pastDays = days(-7, 7);
  const nextDays = days(1, 7);
  const pastEvents = pastDays.reduce((s, k) => s + eventsOn(events, k).length, 0);
  const upcoming = nextDays.flatMap((k) => eventsOn(events, k).map((e) => ({ e, k })));
  const dueNext = tasks.filter((x) => !x.done && x.due && nextDays.includes(x.due)).length;

  const spentIn = (keys: string[]) => txs.filter((x) => x.type === 'expense' && keys.includes(x.date)).reduce((s, x) => s + x.amount, 0);
  const spent = spentIn(pastDays);
  const spentPrev = spentIn(days(-14, 7));
  const delta = spentPrev > 0 ? Math.round(((spent - spentPrev) / spentPrev) * 100) : null;

  const activeGoals = goals.filter((g) => !g.archived);
  const newIdeas = ideas.filter((i) => i.createdAt >= weekAgo).length;

  const finish = () => {
    setSettings({ lastReview: today });
    router.back();
  };

  return (
    <Screen
      title={t('review.title')}
      subtitle={lastReview ? t('review.last', { d: relativeDay(lastReview) }) : t('review.subtitle')}
      leading={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />}
    >
      <Animated.View entering={FadeInDown.duration(motion.slow)}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat icon="check-circle" value={String(done.length)} label={t('review.done')} />
          <Stat icon="calendar" value={String(pastEvents)} label={t('review.events')} />
          <Stat icon="credit-card" value={formatMoney(spent, currency, { compact: true })} label={t('review.spent')} />
        </View>
        {delta !== null && (
          <Text variant="caption" tone="faint" style={{ marginTop: space.sm }}>
            {delta === 0 ? t('review.spentSame') : delta > 0 ? t('review.spentMore', { p: delta }) : t('review.spentLess', { p: -delta })}
          </Text>
        )}
      </Animated.View>

      <SectionHeader title={t('review.pending', { n: overdue.length })} />
      {overdue.length === 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Icon name="smile" size={18} color={c.success} />
          <Text variant="body" tone="muted" style={{ flex: 1 }}>
            {t('review.noPending')}
          </Text>
        </Card>
      ) : (
        <Card padded={false}>
          {overdue.map((x, i) => (
            <Animated.View key={x.id} exiting={FadeOut.duration(motion.fast)} layout={LinearTransition}>
              {i > 0 && <Divider inset={space.lg} />}
              <PendingRow task={x} />
            </Animated.View>
          ))}
        </Card>
      )}
      {undated > 0 && (
        <PressableScale onPress={() => router.navigate('/lists')} style={{ marginTop: space.sm }}>
          <Text variant="caption" tone="accent">
            {t('review.undated', { n: undated })}
          </Text>
        </PressableScale>
      )}

      {activeGoals.length > 0 && (
        <>
          <SectionHeader title={t('review.goals')} />
          <Card style={{ gap: space.lg }}>
            {activeGoals.map((g) => (
              <View key={g.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <IconButton icon="minus" size={28} label={t('ev.less')} onPress={() => updateGoal(g.id, { progress: Math.max(0, g.progress - 10) })} />
                  <Text variant="caption" tabular style={{ width: 40, textAlign: 'center', fontWeight: '600' }}>
                    {g.progress}%
                  </Text>
                  <IconButton icon="plus" size={28} label={t('ev.more')} onPress={() => updateGoal(g.id, { progress: Math.min(100, g.progress + 10) })} />
                </View>
                <ProgressBar value={g.progress / 100} color={g.color} />
                {g.deadline ? (
                  <Text variant="caption" tone="faint">
                    {t('review.deadline', { d: formatShortDate(fromKey(g.deadline)) })}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionHeader title={t('review.nextWeek')} action={t('today.viewCalendar')} onAction={() => router.navigate('/calendar')} />
      <Card style={{ gap: space.sm }}>
        <Text variant="body" tone="muted">
          {t('review.nextSummary', { e: upcoming.length, t: dueNext })}
        </Text>
        {upcoming.slice(0, 6).map(({ e, k }) => (
          <View key={`${e.id}-${k}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: e.color }} />
            <Text variant="caption" tone="muted" style={{ width: 90 }} numberOfLines={1}>
              {relativeDay(k)}
            </Text>
            <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
              {e.title}
            </Text>
            {!e.allDay && (
              <Text variant="caption" tone="faint" tabular>
                {e.start}
              </Text>
            )}
          </View>
        ))}
      </Card>

      {newIdeas > 0 && (
        <PressableScale onPress={() => router.navigate('/ideas')} style={{ marginTop: space.md }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Icon name="zap" size={16} color={c.accent} />
            <Text variant="body" style={{ flex: 1 }}>
              {t('review.ideas', { n: newIdeas })}
            </Text>
            <Icon name="chevron-right" size={16} color={c.textFaint} />
          </Card>
        </PressableScale>
      )}

      <View style={{ marginTop: space.xxl }}>
        <Button title={t('review.finish')} icon="check" full onPress={finish} />
      </View>
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: 'check-circle' | 'calendar' | 'credit-card'; value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: space.md, gap: 4 }}>
      <Icon name={icon} size={14} color={c.accent} />
      <Text variant="heading" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Tarea vencida con acciones: hoy, mañana, próxima semana, hecha. */
function PendingRow({ task }: { task: Task }) {
  const { c } = useTheme();
  const { t } = useT();
  const update = useStore((s) => s.updateTask);
  const toggle = useStore((s) => s.toggleTask);
  const move = (n: number) => {
    update(task.id, { due: toKey(addDays(new Date(), n)) });
  };
  const chip = (label: string, onPress: () => void) => (
    <PressableScale onPress={onPress} accessibilityRole="button" style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: c.surfaceAlt, justifyContent: 'center' }}>
      <Text variant="caption">{label}</Text>
    </PressableScale>
  );
  return (
    <View style={{ padding: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text variant="body" style={{ flex: 1 }} numberOfLines={2}>
          {task.title}
        </Text>
        <Text variant="caption" style={{ color: c.danger }}>
          {task.due ? relativeDay(task.due) : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {chip(t('common.today'), () => move(0))}
        {chip(t('common.tomorrow'), () => move(1))}
        {chip(t('review.nextWeekShort'), () => move(7 - ((new Date().getDay() + 6) % 7)))}
        {chip(t('review.markDone'), () => {
          toggle(task.id);
        })}
      </View>
    </View>
  );
}
