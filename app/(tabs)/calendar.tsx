import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { EventRow, TaskRow } from '@/components/rows';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { EmptyState, IconButton, SectionHeader } from '@/components/ui';
import {
  addMonths,
  eventsOn,
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

  const dayEvents = useMemo(() => eventsOn(events, selected), [events, selected]);
  const dayTasks = useMemo(() => tasks.filter((x) => x.due === selected), [tasks, selected]);

  const shift = (n: 1 | -1) => {
    setDir(n);
    setMonth((m) => addMonths(m, n));
  };

  const togglePicker = () => {
    setPickYear(month.getFullYear());
    setPicker((v) => !v);
  };

  const pickMonth = (m: number) => {
    const d = new Date(pickYear, m, 1);
    setDir(d < month ? -1 : 1);
    setMonth(d);
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
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;

  return (
    <Screen
      tabbed
      title={formatMonthTitle(month)}
      subtitle={t('cal.subtitle')}
      onTitlePress={togglePicker}
      titleOpen={picker}
      titleHint={t('cal.pickMonth')}
      actions={
        <>
          <IconButton icon="chevron-left" label={t('common.prevMonth')} onPress={() => shift(-1)} />
          <IconButton icon="chevron-right" label={t('common.nextMonth')} onPress={() => shift(1)} />
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
                  style={styles.cell}
                >
                  <View
                    style={{
                      width: CIRCLE,
                      height: CIRCLE,
                      borderRadius: radius.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSel ? c.text : 'transparent',
                      borderWidth: isToday && !isSel ? 1.5 : 0,
                      borderColor: c.accent,
                    }}
                  >
                    <Text
                      variant="caption"
                      tabular
                      style={{
                        color: isSel ? c.bg : isToday ? c.accent : inMonth ? c.text : c.textFaint,
                        fontWeight: isSel || isToday ? '700' : '400',
                      }}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, height: 4, marginTop: 1 }}>
                    {mark?.colors.map((col, i) => (
                      <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: inMonth ? col : c.textFaint }} />
                    ))}
                    {mark && mark.tasks > 0 && mark.colors.length < 3 ? (
                      <View style={{ width: 4, height: 4, borderRadius: 1, backgroundColor: c.textMuted }} />
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
    </Screen>
  );
}

/** Escritorio: calendario compacto a la izquierda y detalle del día a la derecha. Móvil: uno debajo del otro. */
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
      <View style={{ width: 340 }}>{left}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{right}</View>
    </View>
  );
}

/** Celdas de altura fija: el mes ocupa lo mismo en un teléfono que en un monitor ancho. */
const CELL_H = 42;
const CIRCLE = 30;

const styles = StyleSheet.create({
  grid: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.sm, paddingTop: space.md, paddingBottom: space.xs },
  cell: { width: `${100 / 7}%`, height: CELL_H, alignItems: 'center', justifyContent: 'center' },
  picker: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.md, marginBottom: space.lg, gap: space.sm },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  monthBtn: { flexBasis: '22%', flexGrow: 1, height: 40, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
