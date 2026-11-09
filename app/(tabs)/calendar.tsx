import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { EventRow, TaskRow } from '@/components/rows';
import { Screen } from '@/components/Screen';
import { WeekGrid } from '@/components/WeekGrid';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { EmptyState, IconButton, SectionHeader } from '@/components/ui';
import {
  addDays,
  addMonths,
  eventsOn,
  formatShortDate,
  formatLongDate,
  formatMonthTitle,
  fromKey,
  monthMatrix,
  monthNames,
  toKey,
  todayKey,
  weekdayLabels,
} from '@/lib/date';
import { useIsDesktop } from '@/desktop/layout';
import { useT } from '@/i18n/useT';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

export default function CalendarScreen() {
  const { c } = useTheme();
  const { t } = useT();
  const isDesktop = useIsDesktop();
  const now = useNow();
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const weekStartsMonday = useStore((s) => s.settings.weekStartsMonday);
  const view = useStore((s) => s.settings.calendarView ?? 'month');
  const setSettings = useStore((s) => s.setSettings);

  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(todayKey());
  const [dir, setDir] = useState<1 | -1>(1);
  // Selector de mes y año (al pulsar el título): saltar a cualquier fecha sin pasar mes a mes.
  const [picker, setPicker] = useState(false);
  const [pickYear, setPickYear] = useState(() => new Date().getFullYear());

  const days = useMemo(() => monthMatrix(month.getFullYear(), month.getMonth(), weekStartsMonday), [month, weekStartsMonday]);

  const marks = useMemo(() => {
    const m = new Map<string, { colors: string[]; tasks: number }>();
    for (const d of days) {
      const k = toKey(d);
      const colors = eventsOn(events, k).slice(0, 3).map((e) => e.color);
      const n = tasks.filter((x) => !x.done && x.due === k).length;
      if (colors.length || n) m.set(k, { colors, tasks: n });
    }
    return m;
  }, [days, events, tasks]);

  // Semana del día elegido (empieza en lunes o domingo según los ajustes).
  const weekDays = useMemo(() => {
    const d = fromKey(selected);
    const offset = weekStartsMonday ? (d.getDay() + 6) % 7 : d.getDay();
    const start = addDays(d, -offset);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selected, weekStartsMonday]);
  const weekKey = toKey(weekDays[0]);

  const dayEvents = useMemo(() => eventsOn(events, selected), [events, selected]);
  const dayTasks = useMemo(() => tasks.filter((x) => x.due === selected), [tasks, selected]);

  const shift = (n: 1 | -1) => {
    setDir(n);
    if (view === 'week') {
      const d = addDays(fromKey(selected), 7 * n);
      setSelected(toKey(d));
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    } else setMonth((m) => addMonths(m, n));
  };

  const togglePicker = () => {
    setPickYear(month.getFullYear());
    setPicker((v) => !v);
  };

  const pickMonth = (m: number) => {
    const d = new Date(pickYear, m, 1);
    setDir(d < month ? -1 : 1);
    setMonth(d);
    if (view === 'week') setSelected(toKey(d));
    setPicker(false);
  };

  const goToday = () => {
    const d = new Date();
    setDir(d < month ? -1 : 1);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(todayKey());
  };

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationX < -50) shift(1);
      else if (e.translationX > 50) shift(-1);
    });

  const today = todayKey();
  // Escritorio: celdas más grandes para que el mes se lea de un vistazo.
  const cellH = isDesktop ? 62 : 48;
  const circle = isDesktop ? 40 : 32;
  const dot = isDesktop ? 5 : 4;
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;

  return (
    <Screen
      tabbed
      maxWidth={isDesktop ? 1180 : undefined}
      title={formatMonthTitle(view === 'week' ? weekDays[0] : month)}
      subtitle={view === 'week' ? `${formatShortDate(weekDays[0])} – ${formatShortDate(weekDays[6])}` : t('cal.subtitle')}
      onTitlePress={togglePicker}
      titleOpen={picker}
      titleHint={t('cal.pickMonth')}
      actions={
        <>
          <IconButton icon="chevron-left" label={view === 'week' ? t('cal.prevWeek') : t('common.prevMonth')} onPress={() => shift(-1)} />
          <IconButton icon="chevron-right" label={view === 'week' ? t('cal.nextWeek') : t('common.nextMonth')} onPress={() => shift(1)} />
          <IconButton icon="plus" label={t('cal.newEvent')} variant="accent" onPress={() => router.push({ pathname: '/form/event', params: { date: selected } })} />
        </>
      }
    >
      {picker ? (
        <Animated.View entering={FadeInDown.duration(motion.base)} style={[styles.picker, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.pickerHead}>
            <IconButton icon="chevron-left" label={t('cal.prevYear')} onPress={() => setPickYear((y) => y - 1)} />
            <Text variant="heading" tabular>
              {pickYear}
            </Text>
            <IconButton icon="chevron-right" label={t('cal.nextYear')} onPress={() => setPickYear((y) => y + 1)} />
          </View>
          <View style={styles.months}>
            {monthNames('short').map((name, m) => {
              const isCur = pickYear === month.getFullYear() && m === month.getMonth();
              const isNow = pickYear === now.getFullYear() && m === now.getMonth();
              return (
                <Pressable
                  key={m}
                  onPress={() => pickMonth(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isCur }}
                  style={[styles.monthBtn, { backgroundColor: isCur ? c.accent : 'transparent', borderColor: isNow && !isCur ? c.accent : c.border }]}
                >
                  <Text variant="bodyStrong" style={{ color: isCur ? c.onAccent : isNow ? c.accent : c.text }}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.lg }}>
        <View style={{ width: 240 }}>
          <Segmented<'month' | 'week'>
            value={view}
            onChange={(v) => setSettings({ calendarView: v })}
            options={[
              { value: 'month', label: t('cal.viewMonth') },
              { value: 'week', label: t('cal.viewWeek') },
            ]}
          />
        </View>
        {view === 'week' && !weekDays.some((d) => toKey(d) === today) ? (
          <Text variant="caption" tone="accent" onPress={goToday} accessibilityRole="button">
            {t('cal.goToday')}
          </Text>
        ) : null}
      </View>
      {view === 'week' ? (
        <Animated.View key={weekKey} entering={(dir === 1 ? SlideInRight : SlideInLeft).duration(motion.base)}>
          <WeekGrid
            days={weekDays}
            today={today}
            now={now}
            onPickDay={(k) => {
              setSelected(k);
              setSettings({ calendarView: 'month' });
            }}
          />
          <Text variant="caption" tone="faint" style={{ marginTop: space.sm }}>
            {t('cal.weekHint')}
          </Text>
        </Animated.View>
      ) : (
      <SplitLayout
        desktop={isDesktop}
        left={
      <GestureDetector gesture={swipe}>
        <View style={[styles.grid, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={{ flexDirection: 'row', marginBottom: space.xs }}>
            {weekdayLabels(weekStartsMonday).map((d, i) => (
              <Text key={i} variant="label" tone="faint" align="center" style={{ flex: 1 }}>
                {d}
              </Text>
            ))}
          </View>

          <Animated.View key={monthKey} entering={(dir === 1 ? SlideInRight : SlideInLeft).duration(motion.base)} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {days.map((d) => {
              const k = toKey(d);
              const inMonth = d.getMonth() === month.getMonth();
              const isSel = k === selected;
              const isToday = k === today;
              const mark = marks.get(k);
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    setSelected(k);
                    if (!inMonth) {
                      setDir(d < month ? -1 : 1);
                      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={`${formatLongDate(d)}${mark ? `, ${t('cal.eventsA11y', { n: mark.colors.length })}` : ''}`}
                  style={[styles.cell, { height: cellH }]}
                >
                  <View
                    style={{
                      width: circle,
                      height: circle,
                      borderRadius: radius.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSel ? c.text : 'transparent',
                      borderWidth: isToday && !isSel ? 1.5 : 0,
                      borderColor: c.accent,
                    }}
                  >
                    <Text
                      variant={isDesktop ? 'body' : 'caption'}
                      tabular
                      style={{
                        color: isSel ? c.bg : isToday ? c.accent : inMonth ? c.text : c.textFaint,
                        fontWeight: isSel || isToday ? '700' : '400',
                      }}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, height: dot, marginTop: 2 }}>
                    {mark?.colors.map((col, i) => (
                      <View key={i} style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: inMonth ? col : c.textFaint }} />
                    ))}
                    {mark && mark.tasks > 0 && mark.colors.length < 3 ? (
                      <View style={{ width: dot, height: dot, borderRadius: 1, backgroundColor: c.textMuted }} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>
        }
        right={
      <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: isDesktop ? 0 : space.lg }}>
        <Animated.View key={selected} entering={FadeIn.duration(motion.base)} style={{ flex: 1 }}>
          <Text variant="heading">{formatLongDate(fromKey(selected))}</Text>
        </Animated.View>
        {(selected !== today || month.getMonth() !== now.getMonth()) && (
          <Text variant="caption" tone="accent" onPress={goToday} accessibilityRole="button">
            {t('cal.goToday')}
          </Text>
        )}
      </View>

      <View style={{ marginTop: space.md }}>
        {dayEvents.length === 0 && dayTasks.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={t('cal.freeTitle')}
            subtitle={t('cal.freeBody')}
            action={t('cal.addEvent')}
            onAction={() => router.push({ pathname: '/form/event', params: { date: selected } })}
          />
        ) : (
          <Animated.View key={`list-${selected}`} entering={FadeInDown.duration(motion.base)}>
            {dayEvents.map((e, i) => (
              <EventRow key={e.id} event={e} date={selected} index={i} now={now} />
            ))}
            {dayTasks.length > 0 && (
              <>
                <SectionHeader title={t('cal.datedTasks')} />
                {dayTasks.map((x, i) => (
                  <TaskRow key={x.id} task={x} index={i} showDue={false} />
                ))}
              </>
            )}
          </Animated.View>
        )}
      </View>
      </>
        }
      />
      )}
    </Screen>
  );
}

/** Ventana ancha: el mes a la izquierda y el detalle del día a la derecha. Ventana estrecha: uno debajo del otro. */
function SplitLayout({ desktop, left, right }: { desktop: boolean; left: ReactNode; right: ReactNode }) {
  if (!desktop) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl }}>
      <View style={{ width: 520 }}>{left}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.sm, paddingTop: space.md, paddingBottom: space.xs },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center' },
  weekCol: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: space.md },
  weekAdd: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  weekItem: { borderRadius: radius.sm, borderLeftWidth: 3, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, gap: 1 },
  weekRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 3 },
  picker: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.md, marginBottom: space.lg, gap: space.sm },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  monthBtn: { flexBasis: '22%', flexGrow: 1, height: 40, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
