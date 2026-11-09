import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ViewProps } from 'react-native';
import { Checkbox } from '@/components/Checkbox';
import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { addDays, eventsOn, formatClock, formatLongDate, formatTime, fromKey, minutesToTime, timeToMinutes, toKey, weekdayName } from '@/lib/date';
import { showDialog } from '@/lib/dialog';
import { useStore } from '@/store';
import type { CalendarEvent } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Alto de una hora en la cuadrícula. */
const HOUR_H = 52;
/** Columna de las horas a la izquierda. */
const GUTTER = 56;
/** Los arrastres se ajustan a cuartos de hora. */
const SNAP = 15;
const DAY_MIN = 24 * 60;
const REMINDER_DUR = 30;

type Kind = 'event' | 'reminder' | 'task';

interface Item {
  key: string;
  kind: Kind;
  id: string;
  /** Columna del día (0–6). */
  day: number;
  /** Minutos desde las 00:00 (solo en la cuadrícula). */
  start: number;
  dur: number;
  title: string;
  color: string;
  /** Fecha de esta aparición (eventos repetidos). */
  occ: string;
  allDay: boolean;
  done?: boolean;
  priority?: number;
  ev?: CalendarEvent;
  col: number;
  cols: number;
}

interface Drag {
  item: Item;
  x0: number;
  y0: number;
  /** Diferencia entre el punto agarrado y el inicio del elemento, en minutos. */
  grab: number;
  moved: boolean;
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
type PE = { nativeEvent: { clientX: number; clientY: number; button?: number }; stopPropagation: () => void };
const el = (r: unknown) => r as HTMLElement | null;
/** View con eventos de puntero del navegador (react-native-web). */
const PView = View as unknown as ComponentType<Omit<ViewProps, 'onPointerDown' | 'onPointerUp'> & { onPointerDown?: (e: PE) => void; onPointerUp?: (e: PE) => void; ref?: unknown }>;

/** Coloca los elementos que se solapan uno al lado del otro. */
function layoutDay(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.dur - a.dur);
  let cluster: Item[] = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const close = () => {
    for (const it of cluster) it.cols = ends.length;
    cluster = [];
    ends = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) close();
    let col = ends.findIndex((e) => e <= it.start);
    if (col === -1) {
      col = ends.length;
      ends.push(0);
    }
    ends[col] = it.start + it.dur;
    it.col = col;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.start + it.dur);
  }
  close();
}

/**
 * Vista semanal con horas: los eventos y recordatorios se colocan a su hora y se pueden arrastrar
 * a otro día u otra hora. Las tareas y los eventos de todo el día van en la franja de arriba.
 */
export function WeekGrid({ days, today, now, onPickDay }: { days: Date[]; today: string; now: Date; onPickDay: (key: string) => void }) {
  const { c } = useTheme();
  const { t } = useT();
  const { height: winH } = useWindowDimensions();
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const reminders = useStore((s) => s.reminders);
  const use24h = useStore((s) => s.settings.use24h);
  const updateEvent = useStore((s) => s.updateEvent);
  const addEvent = useStore((s) => s.addEvent);
  const skipOccurrence = useStore((s) => s.skipOccurrence);
  const updateTask = useStore((s) => s.updateTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const updateReminder = useStore((s) => s.updateReminder);

  const keys = useMemo(() => days.map(toKey), [days]);

  const { timed, allDay } = useMemo(() => {
    const timed: Item[][] = keys.map(() => []);
    const allDay: Item[][] = keys.map(() => []);
    keys.forEach((k, day) => {
      for (const e of eventsOn(events, k)) {
        const base = { key: `e-${e.id}-${k}`, kind: 'event' as const, id: e.id, day, title: e.title, color: e.color, occ: k, ev: e, col: 0, cols: 1 };
        if (e.allDay) allDay[day].push({ ...base, start: 0, dur: 0, allDay: true });
        else {
          const s = timeToMinutes(e.start);
          timed[day].push({ ...base, start: s, dur: Math.max(SNAP, timeToMinutes(e.end) - s), allDay: false });
        }
      }
      for (const r of reminders) {
        const d = new Date(r.at);
        if (toKey(d) !== k) continue;
        timed[day].push({ key: `r-${r.id}`, kind: 'reminder', id: r.id, day, start: d.getHours() * 60 + d.getMinutes(), dur: REMINDER_DUR, title: r.title, color: c.accent, occ: k, allDay: false, done: r.done, col: 0, cols: 1 });
      }
      for (const x of tasks) {
        if (x.due !== k) continue;
        allDay[day].push({ key: `t-${x.id}`, kind: 'task', id: x.id, day, start: 0, dur: 0, title: x.title, color: c.textMuted, occ: k, allDay: true, done: x.done, priority: x.priority, col: 0, cols: 1 });
      }
      layoutDay(timed[day]);
      allDay[day].sort((a, b) => Number(a.kind === 'task') - Number(b.kind === 'task') || Number(!!a.done) - Number(!!b.done));
    });
    return { timed, allDay };
  }, [keys, events, reminders, tasks, c.accent, c.textMuted]);

  const gridRef = useRef<View>(null);
  const allDayRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<{ key: string; day: number; start: number } | null>(null);
  const bgDown = useRef<{ x: number; y: number } | null>(null);
  const dragPos = useRef<{ day: number; start: number } | null>(null);

  // Al abrir: la cuadrícula empieza un par de horas antes de la hora actual.
  useEffect(() => {
    const y = Math.max(0, (new Date().getHours() - 2) * HOUR_H - 10);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    return () => clearTimeout(id);
  }, []);

  const scrollNode = () => el((scrollRef.current as unknown as { getScrollableNode?: () => unknown })?.getScrollableNode?.());

  const open = (it: Item) => {
    if (it.kind === 'event') router.push({ pathname: '/form/event', params: { id: it.id, occ: it.occ } });
    else if (it.kind === 'reminder') router.push({ pathname: '/form/reminder', params: { id: it.id } });
    else router.push({ pathname: '/form/task', params: { id: it.id } });
  };

  const commit = (it: Item, day: number, start: number) => {
    const newKey = keys[day];
    if (day === it.day && start === it.start) return;
    if (it.kind === 'task') return updateTask(it.id, { due: newKey });
    if (it.kind === 'reminder') {
      const d = fromKey(newKey);
      d.setHours(Math.floor(start / 60), start % 60, 0, 0);
      return updateReminder(it.id, { at: d.getTime() });
    }
    const ev = it.ev!;
    const time = it.allDay ? {} : { start: minutesToTime(start), end: minutesToTime(Math.min(start + it.dur, DAY_MIN - 1)) };
    if (ev.repeat === 'none') return updateEvent(ev.id, { date: newKey, ...time });
    // Evento que se repite: mover solo esta vez o toda la serie.
    const delta = Math.round((fromKey(newKey).getTime() - fromKey(it.occ).getTime()) / 86_400_000);
    showDialog(t('cal.moveTitle'), t('cal.moveBody'), [
      {
        text: t('cal.moveOne'),
        onPress: async () => {
          const { id: _id, notificationIds: _n, ...rest } = ev;
          await skipOccurrence(ev.id, it.occ);
          await addEvent({ ...rest, date: newKey, ...time, repeat: 'none', interval: 1, until: null, exceptions: [] });
        },
      },
      { text: t('cal.moveAll'), onPress: () => updateEvent(ev.id, { date: toKey(addDays(fromKey(ev.date), delta)), ...time }) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const onMove = (ev: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 4) return;
    d.moved = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    const box = el(d.item.allDay ? allDayRef.current : gridRef.current)?.getBoundingClientRect();
    if (!box) return;
    const colW = (box.width - GUTTER) / 7;
    const day = clamp(Math.floor((ev.clientX - box.left - GUTTER) / colW), 0, 6);
    let start = d.item.start;
    if (!d.item.allDay) {
      // El evento no puede pasar de las 23:59.
      const maxStart = Math.max(0, Math.floor((d.item.kind === 'event' ? DAY_MIN - 1 - d.item.dur : DAY_MIN - SNAP) / SNAP) * SNAP);
      start = clamp(snap(((ev.clientY - box.top) / HOUR_H) * 60 - d.grab), 0, maxStart);
      // Cerca del borde, la cuadrícula se desplaza sola.
      const sc = scrollNode();
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (ev.clientY < r.top + 36) sc.scrollTop -= 14;
        else if (ev.clientY > r.bottom - 36) sc.scrollTop += 14;
      }
    }
    dragPos.current = { day, start };
    setDrag((p) => (p && p.key === d.item.key && p.day === day && p.start === start ? p : { key: d.item.key, day, start }));
  };

  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    const d = dragRef.current;
    const pos = dragPos.current;
    dragRef.current = null;
    dragPos.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) open(d.item);
    else if (pos) commit(d.item, pos.day, pos.start);
  };

  const startDrag = (it: Item, e: PE) => {
    e.stopPropagation();
    if ((e.nativeEvent.button ?? 0) !== 0) return;
    let grab = 0;
    if (!it.allDay) {
      const box = el(gridRef.current)?.getBoundingClientRect();
      if (box) grab = ((e.nativeEvent.clientY - box.top) / HOUR_H) * 60 - it.start;
    }
    dragRef.current = { item: it, x0: e.nativeEvent.clientX, y0: e.nativeEvent.clientY, grab, moved: false };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Clic en un hueco vacío: nuevo evento a esa hora (o de ese día, en la franja de arriba).
  const bgPointerDown = (e: PE) => {
    bgDown.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  };
  const bgPointerUp = (e: PE, row: 'grid' | 'allday') => {
    const p = bgDown.current;
    bgDown.current = null;
    if (!p || dragRef.current || Math.hypot(e.nativeEvent.clientX - p.x, e.nativeEvent.clientY - p.y) > 4) return;
    const box = el(row === 'grid' ? gridRef.current : allDayRef.current)?.getBoundingClientRect();
    if (!box) return;
    const x = e.nativeEvent.clientX - box.left - GUTTER;
    if (x < 0) return;
    const day = clamp(Math.floor(x / ((box.width - GUTTER) / 7)), 0, 6);
    if (row === 'allday') return router.push({ pathname: '/form/event', params: { date: keys[day] } });
    const start = clamp(Math.floor((((e.nativeEvent.clientY - box.top) / HOUR_H) * 60) / 30) * 30, 0, 23 * 60);
    router.push({ pathname: '/form/event', params: { date: keys[day], start: minutesToTime(start) } });
  };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx = keys.indexOf(today);
  const rowMax = Math.max(1, ...allDay.map((l) => l.length));
  // La semana cabe en la ventana: solo se desplazan las horas.
  const gridH = Math.max(320, winH - 450 - rowMax * 26);

  /** Posición mientras se arrastra (o la normal). */
  const place = (it: Item) => (drag && drag.key === it.key ? { day: drag.day, start: drag.start, dragging: true } : { day: it.day, start: it.start, dragging: false });

  const renderTimed = (it: Item) => {
    const p = place(it);
    const top = (p.start / 60) * HOUR_H;
    const h = Math.max(22, (it.dur / 60) * HOUR_H - 2);
    const w = p.dragging ? 1 : 1 / it.cols;
    const left = p.dragging ? 0 : it.col / it.cols;
    const isRem = it.kind === 'reminder';
    const label = isRem
      ? formatClock(new Date(2000, 0, 1, Math.floor(p.start / 60), p.start % 60), use24h)
      : `${formatTime(minutesToTime(p.start), use24h)} – ${formatTime(minutesToTime(Math.min(p.start + it.dur, DAY_MIN - 1)), use24h)}`;
    return (
      <PView
        key={it.key}
        onPointerDown={(e: PE) => startDrag(it, e)}
        accessibilityRole="button"
        accessibilityLabel={`${it.title}, ${label}`}
        style={[
          styles.block,
          webGrab,
          {
            top: top + 1,
            height: h,
            left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${(p.day + left) / 7} + 2px)` as unknown as number,
            width: `calc((100% - ${GUTTER}px) * ${w / 7} - 4px)` as unknown as number,
            backgroundColor: c.surface,
            borderColor: p.dragging ? it.color : c.border,
            opacity: it.done ? 0.55 : 1,
            zIndex: p.dragging ? 50 : 2,
          },
          p.dragging ? webLift : null,
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: it.color, opacity: isRem ? 0.1 : 0.16, borderRadius: radius.sm - 1 }]} />
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: it.color }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {isRem ? <Icon name="bell" size={11} color={it.color} /> : null}
          <Text variant="caption" numberOfLines={h > 36 ? 2 : 1} style={{ flex: 1, fontWeight: '600', color: c.text, textDecorationLine: it.done ? 'line-through' : 'none' }}>
            {it.title}
          </Text>
          {h <= 30 ? (
            <Text variant="caption" tabular numberOfLines={1} style={{ color: c.textMuted, fontSize: 11 }}>
              {formatTime(minutesToTime(p.start), use24h)}
            </Text>
          ) : null}
        </View>
        {h > 30 ? (
          <Text variant="caption" tabular numberOfLines={1} style={{ color: c.textMuted, fontSize: 11 }}>
            {label}
          </Text>
        ) : null}
      </PView>
    );
  };

  const renderAllDay = (it: Item, i: number) => {
    const p = place(it);
    const isTask = it.kind === 'task';
    return (
      <PView
        key={it.key}
        onPointerDown={(e: PE) => startDrag(it, e)}
        accessibilityRole="button"
        accessibilityLabel={it.title}
        style={[
          styles.chip,
          webGrab,
          {
            top: 4 + i * 26,
            left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${p.day / 7} + 2px)` as unknown as number,
            width: `calc((100% - ${GUTTER}px) / 7 - 4px)` as unknown as number,
            backgroundColor: isTask ? c.surfaceAlt : c.surface,
            borderColor: p.dragging ? c.accent : 'transparent',
            zIndex: p.dragging ? 50 : 2,
          },
          p.dragging ? webLift : null,
        ]}
      >
        {isTask ? (
          // El círculo marca la tarea como hecha sin empezar a arrastrar.
            <PView onPointerDown={(e: PE) => e.stopPropagation()}>
            <Checkbox checked={!!it.done} onToggle={() => toggleTask(it.id)} label={it.title} size={14} color={it.priority === 2 ? c.danger : undefined} />
          </PView>
        ) : (
          <>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: it.color, opacity: 0.16, borderRadius: radius.sm - 1 }]} />
            <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: it.color }} />
          </>
        )}
        <Text variant="caption" numberOfLines={1} style={{ flex: 1, color: it.done ? c.textFaint : c.text, fontWeight: isTask ? '400' : '600', textDecorationLine: it.done ? 'line-through' : 'none' }}>
          {it.title}
        </Text>
      </PView>
    );
  };

  const dayLines = days.map((_, i) => (
    <View key={i} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${i / 7})` as unknown as number, width: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
  ));

  return (
    <View style={[styles.wrap, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* Cabecera: días de la semana (clic: ver ese día en el mes) */}
      <View style={[styles.head, { borderBottomColor: c.border }]}>
        <View style={{ width: GUTTER }} />
        {days.map((d, i) => {
          const isToday = keys[i] === today;
          return (
            <Pressable
              key={i}
              onPress={() => onPickDay(keys[i])}
              accessibilityRole="button"
              accessibilityLabel={formatLongDate(d)}
              style={({ pressed }) => [styles.headCell, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text variant="label" upper style={{ color: isToday ? c.accent : c.textFaint }}>
                {weekdayName(d.getDay(), 'short')}
              </Text>
              <View style={[styles.dayNum, { backgroundColor: isToday ? c.accent : 'transparent' }]}>
                <Text variant="heading" tabular style={{ color: isToday ? c.onAccent : c.text }}>
                  {d.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Franja de todo el día: eventos de día completo y tareas con fecha */}
      <PView
        ref={allDayRef}
        onPointerDown={bgPointerDown}
        onPointerUp={(e: PE) => bgPointerUp(e, 'allday')}
        style={{ height: 8 + rowMax * 26, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}
      >
        {dayLines}
        <Text variant="caption" tone="faint" style={{ position: 'absolute', left: 6, top: 6, width: GUTTER - 10, fontSize: 10, lineHeight: 12 }}>
          {t('row.allDay')}
        </Text>
        {allDay.map((list) => list.map(renderAllDay))}
      </PView>

      {/* Cuadrícula de horas */}
      <ScrollView ref={scrollRef} style={{ height: gridH }} showsVerticalScrollIndicator>
        <PView
          ref={gridRef}
          onPointerDown={bgPointerDown}
          onPointerUp={(e: PE) => bgPointerUp(e, 'grid')}
          style={{ height: 24 * HOUR_H }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <View key={h} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: h * HOUR_H, height: HOUR_H }}>
              {h > 0 ? <View style={{ position: 'absolute', left: GUTTER - 6, right: 0, top: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border }} /> : null}
              {h > 0 ? (
                <Text variant="caption" tabular style={{ position: 'absolute', left: 0, width: GUTTER - 10, top: -8, textAlign: 'right', fontSize: 11, color: c.textFaint }}>
                  {formatTime(minutesToTime(h * 60), use24h)}
                </Text>
              ) : null}
            </View>
          ))}
          {dayLines}
          {todayIdx >= 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                zIndex: 40,
                top: (nowMin / 60) * HOUR_H - 1,
                height: 2,
                backgroundColor: c.danger,
                left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${todayIdx / 7})` as unknown as number,
                width: `calc((100% - ${GUTTER}px) / 7)` as unknown as number,
              }}
            >
              <View style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} />
            </View>
          ) : null}
          {timed.map((list) => list.map(renderTimed))}
        </PView>
      </ScrollView>
    </View>
  );
}

const webGrab = { cursor: 'grab' } as object;
const webLift = { boxShadow: '0 8px 24px rgba(0,0,0,0.22)' } as object;

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  head: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  headCell: { flex: 1, alignItems: 'center', gap: 2 },
  dayNum: { minWidth: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  block: { position: 'absolute', borderRadius: radius.sm, borderWidth: 1, paddingLeft: 8, paddingRight: 4, paddingVertical: 3, overflow: 'hidden', gap: 1 },
  chip: { position: 'absolute', height: 22, borderRadius: radius.sm, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, overflow: 'hidden' },
});
