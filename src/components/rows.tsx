import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useT } from '@/i18n/useT';
import { diffDays, formatTime, relativeDay, todayKey } from '@/lib/date';
import { useStore } from '@/store';
import type { CalendarEvent, DateKey, Task } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { Checkbox } from './Checkbox';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { Icon } from './ui';

const layout = LinearTransition.springify().damping(20).stiffness(180);

export function EventRow({ event, date, index = 0, now }: { event: CalendarEvent; date: DateKey; index?: number; now?: Date }) {
  const { c } = useTheme();
  const { t } = useT();
  const use24h = useStore((s) => s.settings.use24h);

  let live = false;
  if (now && !event.allDay && date === todayKey()) {
    const m = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = event.start.split(':').map(Number);
    const [eh, em] = event.end.split(':').map(Number);
    live = m >= sh * 60 + sm && m < eh * 60 + em;
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(motion.base)} exiting={FadeOut.duration(motion.fast)} layout={layout}>
      <PressableScale
        scaleTo={0.985}
        onPress={() => router.push({ pathname: '/form/event', params: { id: event.id, occ: date } })}
        accessibilityLabel={`${event.title}, ${event.allDay ? t('row.allDay') : `${formatTime(event.start, use24h)} – ${formatTime(event.end, use24h)}`}`}
        style={[styles.eventRow, { backgroundColor: c.surface, borderColor: live ? event.color : c.border }]}
      >
        <View style={{ width: use24h ? 52 : 70 }}>
          {event.allDay ? (
            <Text variant="caption" tone="muted">
              {t('row.allDay')}
            </Text>
          ) : (
            <>
              <Text variant="bodyStrong" tabular>
                {formatTime(event.start, use24h)}
              </Text>
              <Text variant="caption" tone="faint" tabular>
                {formatTime(event.end, use24h)}
              </Text>
            </>
          )}
        </View>
        <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: event.color }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {event.title}
          </Text>
          {event.notes ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {event.notes}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {live && (
            <View style={{ backgroundColor: event.color, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text variant="label" style={{ color: '#0A0A0B', fontSize: 10 }}>
                {t('row.now')}
              </Text>
            </View>
          )}
          {event.repeat !== 'none' && <Icon name="repeat" size={14} color={c.textFaint} />}
          {event.remindBefore !== null && <Icon name="bell" size={14} color={c.textFaint} />}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export function TaskRow({ task, index = 0, showDue = true }: { task: Task; index?: number; showDue?: boolean }) {
  const { c } = useTheme();
  const { t } = useT();
  const toggle = useStore((s) => s.toggleTask);
  const use24hTask = useStore((s) => s.settings.use24h);
  const goal = useStore((s) => (task.goalId ? s.goals.find((g) => g.id === task.goalId) : undefined));
  const overdue = !task.done && task.due !== null && diffDays(task.due, todayKey()) < 0;
  const priorityColor = [c.textFaint, c.warning, c.danger][task.priority];

  const meta: string[] = [];
  if (showDue && task.due) meta.push(relativeDay(task.due));
  if (task.due && task.time) meta.push(formatTime(task.time, use24hTask));
  if (goal) meta.push(goal.title);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(motion.base)} exiting={FadeOut.duration(motion.fast)} layout={layout}>
      <PressableScale
        scaleTo={0.985}
        onPress={() => router.push({ pathname: '/form/task', params: { id: task.id } })}
        accessibilityLabel={t('row.editA11y', { x: task.title })}
        style={styles.taskRow}
      >
        <Checkbox checked={task.done} onToggle={() => toggle(task.id)} label={task.title} color={task.priority === 2 ? c.danger : undefined} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            variant="body"
            numberOfLines={2}
            style={task.done ? { textDecorationLine: 'line-through', color: c.textFaint } : undefined}
          >
            {task.title}
          </Text>
          {meta.length > 0 && !task.done ? (
            <Text variant="caption" tone={overdue ? 'danger' : 'muted'} numberOfLines={1}>
              {overdue ? `${t('row.overdue')} · ` : ''}
              {meta.join(' · ')}
            </Text>
          ) : null}
        </View>
        {task.priority > 0 && !task.done && <Icon name="flag" size={14} color={priorityColor} />}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: space.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 52,
  },
});
