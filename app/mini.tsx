import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/Input';
import { EventRow, TaskRow } from '@/components/rows';
import { Text } from '@/components/Text';
import { Icon, IconButton, SectionHeader } from '@/components/ui';
import { desktop } from '@/desktop/bridge';
import { useT } from '@/i18n/useT';
import { diffDays, eventsOn, formatClock, formatLongDate, todayKey } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { describeQuick, KIND_ICON, runQuick } from '@/lib/quickAdd';
import { parseQuick } from '@/lib/quickParse';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, space } from '@/theme/tokens';

/** Ventana «Hoy» flotante del escritorio: agenda, tareas y recordatorios de hoy, siempre a la vista. */
export default function Mini() {
  const { c } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const key = todayKey();
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const reminders = useStore((s) => s.reminders);
  const use24h = useStore((s) => s.settings.use24h);
  const currency = useStore((s) => s.settings.currency);
  const onboarded = useStore((s) => s.settings.onboarded);
  const [draft, setDraft] = useState('');

  const todays = useMemo(() => eventsOn(events, key), [events, key]);
  const focus = useMemo(
    () =>
      tasks
        .filter((x) => (x.due ? diffDays(x.due, key) <= 0 : false) && (!x.done || (x.doneAt && new Date(x.doneAt).toDateString() === new Date().toDateString())))
        .sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority)
        .slice(0, 12),
    [tasks, key],
  );
  const rems = reminders.filter((r) => !r.done && r.at >= Date.now() && new Date(r.at).toDateString() === now.toDateString());
  const parsed = draft.trim().length >= 2 ? parseQuick(draft) : null;

  if (!onboarded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <Text variant="body" tone="muted" align="center">
          {t('mini.notReady')}
        </Text>
      </View>
    );
  }

  const submit = async () => {
    if (!parsed) return;
    // Sin fecha, lo escrito aquí es para hoy.
    const p = parsed.kind === 'task' && !parsed.date ? { ...parsed, date: key } : parsed;
    if (await runQuick(p)) {
      haptic.soft();
      setDraft('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="title" tabular style={{ fontWeight: '300', fontSize: 34, lineHeight: 40 }}>
              {formatClock(now, use24h)}
            </Text>
            <Text variant="caption" tone="muted">
              {formatLongDate(now)}
            </Text>
          </View>
          <IconButton icon="maximize-2" label={t('mini.openMain')} onPress={() => desktop?.openInMain?.('/')} />
        </View>

        <SectionHeader title={t('today.agenda')} />
        {todays.length === 0 ? (
          <Text variant="caption" tone="faint">
            {t('today.agendaEmpty')}
          </Text>
        ) : (
          todays.map((e, i) => <EventRow key={e.id} event={e} date={key} index={i} now={now} />)
        )}

        {rems.length > 0 && (
          <>
            <SectionHeader title={t('today.reminders')} />
            {rems.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 }}>
                <Icon name="bell" size={14} color={c.accent} />
                <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text variant="caption" tone="muted" tabular>
                  {formatClock(r.at, use24h)}
                </Text>
              </View>
            ))}
          </>
        )}

        <SectionHeader title={t('today.focus')} />
        {focus.length === 0 ? (
          <Text variant="caption" tone="faint">
            {t('today.clear')}
          </Text>
        ) : (
          focus.map((x, i) => <TaskRow key={x.id} task={x} index={i} showDue={x.due !== key} />)
        )}
      </ScrollView>

      <View style={{ padding: space.md, borderTopWidth: 1, borderTopColor: c.border, gap: 6, backgroundColor: c.surface }}>
        <Input placeholder={t('mini.add')} value={draft} onChangeText={setDraft} returnKeyType="done" submitBehavior="submit" onSubmitEditing={submit} />
        {parsed && (parsed.title || parsed.amount) ? (
          <Animated.View entering={FadeIn.duration(motion.fast)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
            <Icon name={KIND_ICON[parsed.kind]} size={12} color={c.accent} />
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              {t(`qa.kind.${parsed.kind}`)}
              {describeQuick(parsed.kind === 'task' && !parsed.date ? { ...parsed, date: key } : parsed, currency) ? ` · ${describeQuick(parsed.kind === 'task' && !parsed.date ? { ...parsed, date: key } : parsed, currency)}` : ''}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
