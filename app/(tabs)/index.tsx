import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Input } from '@/components/Input';
import { PressableScale } from '@/components/PressableScale';
import { ProgressRing } from '@/components/ProgressRing';
import { EventRow, TaskRow } from '@/components/rows';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Icon, IconButton, SectionHeader, type IconName } from '@/components/ui';
import { clockLabel } from '@/constants/cities';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { diffDays, eventsOn, formatClock, formatLongDate, formatTime, greeting, splitTime, timeToMinutes, todayKey } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { openPalette } from '@/lib/palette';
import { parseQuick } from '@/lib/quickParse';
import { dayRelation, dayRelationLabel, formatOffset, offsetFromLocal, zoned } from '@/lib/timezone';
import { reviewDue } from '@/lib/review';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

const quick: { icon: IconName; label: TKey; href: string }[] = [
  { icon: 'calendar', label: 'today.q.event', href: '/form/event' },
  { icon: 'check', label: 'today.q.task', href: '/form/task' },
  { icon: 'bell', label: 'today.q.remind', href: '/form/reminder' },
  { icon: 'minus-circle', label: 'today.q.expense', href: '/form/transaction' },
];

export default function Today() {
  const { c } = useTheme();
  const { t, lang } = useT();
  const now = useNow();
  const key = todayKey();
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const clocks = useStore((s) => s.clocks);
  const reminders = useStore((s) => s.reminders);
  const use24h = useStore((s) => s.settings.use24h);
  const addTask = useStore((s) => s.addTask);
  const lastReview = useStore((s) => s.settings.lastReview);
  const [draft, setDraft] = useState('');

  const todays = useMemo(() => eventsOn(events, key), [events, key]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = todays.find((e) => !e.allDay && timeToMinutes(e.end) > nowMin);

  const focusTasks = useMemo(() => {
    const relevant = tasks.filter((x) => (x.due ? diffDays(x.due, key) <= 0 : !x.done) && (!x.done || (x.doneAt && new Date(x.doneAt).toDateString() === new Date().toDateString())));
    return relevant.sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority).slice(0, 8);
  }, [tasks, key]);

  const doneCount = focusTasks.filter((x) => x.done).length;
  const progress = focusTasks.length ? doneCount / focusTasks.length : 0;

  const todayReminders = reminders.filter((r) => !r.done && r.at >= Date.now() && new Date(r.at).toDateString() === now.toDateString());

  return (
    <Screen
      tabbed
      title={greeting(now)}
      subtitle={formatLongDate(now)}
      actions={
        <>
          <IconButton icon="search" label={t('qa.search')} variant="filled" onPress={() => openPalette()} />
          <IconButton icon="settings" label={t('common.settings')} variant="filled" onPress={() => router.push('/settings')} />
        </>
      }
    >
      {/* Resumen */}
      <Animated.View entering={FadeInDown.duration(motion.slow)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ProgressRing value={progress} size={64}>
            <Text variant="caption" tabular style={{ fontWeight: '700' }}>
              {Math.round(progress * 100)}%
            </Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading">
              {focusTasks.length === 0 ? t('today.clear') : t('today.tasks', { done: doneCount, total: focusTasks.length })}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {next
                ? t('today.next', { title: next.title, time: formatTime(next.start, use24h) })
                : todays.length
                  ? t('today.noMore')
                  : t('today.noEvents')}
            </Text>
          </View>
        </Card>
      </Animated.View>

      {reviewDue(lastReview, now) && (
        <Animated.View entering={FadeInDown.delay(40).duration(motion.slow)} style={{ marginTop: space.md }}>
          <PressableScale onPress={() => router.push('/review')} accessibilityRole="button" scaleTo={0.99}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, borderColor: c.accent }}>
              <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="clipboard" size={16} color={c.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t('review.cta')}</Text>
                <Text variant="caption" tone="muted" numberOfLines={2}>
                  {t('review.ctaBody')}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={c.textFaint} />
            </Card>
          </PressableScale>
        </Animated.View>
      )}

      {/* Acciones rápidas */}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        {quick.map((q, i) => (
          <Animated.View key={q.label} entering={FadeInDown.delay(60 + i * 40).duration(motion.base)} style={{ flex: 1 }}>
            <PressableScale
              hapticOnPress
              onPress={() => router.push(q.href as never)}
              accessibilityLabel={t('today.q.a11y', { x: t(q.label) })}
              style={{ backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingVertical: space.md, alignItems: 'center', gap: 6 }}
            >
              <Icon name={q.icon} size={18} color={c.accent} />
              <Text variant="caption" tone="muted" numberOfLines={1} adjustsFontSizeToFit>
                {t(q.label)}
              </Text>
            </PressableScale>
          </Animated.View>
        ))}
      </View>

      {/* Agenda */}
      <SectionHeader title={t('today.agenda')} action={t('today.viewCalendar')} onAction={() => router.navigate('/calendar')} />
      {todays.length === 0 ? (
        <Text variant="body" tone="faint" style={{ paddingVertical: space.sm }}>
          {t('today.agendaEmpty')}
        </Text>
      ) : (
        todays.map((e, i) => <EventRow key={e.id} event={e} date={key} index={i} now={now} />)
      )}

      {/* Recordatorios de hoy */}
      {todayReminders.length > 0 && (
        <>
          <SectionHeader title={t('today.reminders')} action={t('common.all')} onAction={() => router.push('/alarms')} />
          <Card padded={false}>
            {todayReminders.map((r, i) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <Icon name="bell" size={16} color={c.accent} />
                <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text variant="caption" tone="muted" tabular>
                  {formatClock(r.at, use24h)}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Tareas */}
      <SectionHeader title={t('today.focus')} action={t('common.all')} onAction={() => router.navigate('/lists')} />
      <Input
        placeholder={t('today.addPlaceholder')}
        value={draft}
        onChangeText={setDraft}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={() => {
          if (!draft.trim()) return;
          haptic.soft();
          // «llamar a Ana el viernes !!» → tarea para el viernes con prioridad alta.
          const p = parseQuick(draft);
          addTask({ title: p.kind === 'task' && p.title ? p.title : draft, due: p.kind === 'task' && p.date ? p.date : key, priority: p.priority });
          setDraft('');
        }}
      />
      <View style={{ marginTop: space.xs }}>
        {focusTasks.map((x, i) => (
          <TaskRow key={x.id} task={x} index={i} showDue={x.due !== key} />
        ))}
      </View>

      {/* Relojes */}
      <SectionHeader title={t('today.clocks')} action={t('common.edit')} onAction={() => router.push('/clocks')} />
      {/* En lista, uno debajo de otro: con varias ciudades no se salen por la derecha. */}
      <Card padded={false}>
        {clocks.map((cl, i) => {
          const z = zoned(cl.tz, now);
          const hm = `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
          const rel = dayRelation(cl.tz, now);
          const [time, ampm] = splitTime(hm, use24h);
          return (
            <View
              key={cl.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {clockLabel(cl, lang)}
                </Text>
                <Text variant="caption" tone="faint" numberOfLines={1}>
                  {rel !== 0 ? `${dayRelationLabel(rel)} · ` : ''}
                  {formatOffset(offsetFromLocal(cl.tz, now))}
                </Text>
              </View>
              <Text variant="title" tabular style={{ fontWeight: '300', fontSize: 28 }}>
                {time}
                {ampm ? (
                  <Text variant="caption" tone="muted">
                    {' '}
                    {ampm}
                  </Text>
                ) : null}
              </Text>
            </View>
          );
        })}
        <PressableScale
          onPress={() => router.push('/form/clock')}
          accessibilityRole="button"
          accessibilityLabel={t('today.addClock')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: clocks.length ? 1 : 0, borderTopColor: c.border }}
        >
          <Icon name="plus" size={16} color={c.textMuted} />
          <Text variant="body" tone="muted">
            {t('today.addClock')}
          </Text>
        </PressableScale>
      </Card>
    </Screen>
  );
}
