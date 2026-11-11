import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ViewProps } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Checkbox } from '@/components/Checkbox';
import { Text } from '@/components/Text';
import { Icon, type IconName } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { addDays, eventsOn, formatClock, formatLongDate, formatTime, fromKey, minutesToTime, timeToMinutes, toKey, weekdayName } from '@/lib/date';
import { showDialog } from '@/lib/dialog';
import { useStore } from '@/store';
import type { CalendarEvent } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

/** Alto de una hora en la cuadrícula. */
const HOUR_H = 52;
/** Columna de las horas a la izquierda. */
const GUTTER = 56;
/** Los arrastres se ajustan a cuartos de hora. */
const SNAP = 15;
const DAY_MIN = 24 * 60;
const REMINDER_DUR = 30;
const TASK_DUR = 60;
const CHIP_H = 26;

type Kind = 'event' | 'reminder' | 'task';
type Area = 'grid' | 'allday';

/** Lo copiado con clic derecho → Copiar (se pega en otro hueco o en otra semana). */
let copied: Item | null = null;

/** Menú del clic derecho: sobre un elemento o sobre un hueco vacío. */
type Menu = { x: number; y: number; item?: Item; slot?: { day: number; start: number; area: 'grid' | 'allday' } };

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
  /** Vive en la franja de «todo el día» (sin hora). */
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
  /** «resize»: se jala el borde de abajo para cambiar la duración. */
  mode: 'move' | 'resize';
}

/** Dónde quedaría el elemento si se suelta ahora. */
interface Pos {
  key: string;
  item: Item;
  day: number;
  start: number;
  dur: number;
  area: Area;
  mode: 'move' | 'resize';
}

/** Arrastre sobre un hueco vacío: crea un evento con ese rango. */
interface Create {
  day: number;
  from: number;
  to: number;
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
type PE = { nativeEvent: { clientX: number; clientY: number; button?: number }; stopPropagation: () => void };
const el = (r: unknown) => r as HTMLElement | null;
/** View con eventos de puntero del navegador (react-native-web). */
const PView = View as unknown as ComponentType<Omit<ViewProps, 'onPointerDown' | 'onPointerUp'> & { onPointerDown?: (e: PE) => void; onPointerUp?: (e: PE) => void; ref?: unknown }>;
const colLeft = (x: number) => `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${x / 7} + 2px)` as unknown as number;
const colWidth = (w: number) => `calc((100% - ${GUTTER}px) * ${w / 7} - 4px)` as unknown as number;

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
 * Vista semanal con horas. Eventos, recordatorios y tareas con hora se colocan en la cuadrícula y se
 * pueden arrastrar a otro día u hora o alargar desde el borde de abajo. Las tareas sin hora y los eventos
 * de todo el día van en la franja de arriba; una tarea pasa de una zona a la otra arrastrándola.
 * Cada cambio se puede deshacer, y arrastrar sobre un hueco vacío crea un evento con ese rango.
 */
export function WeekGrid({
  days,
  today,
  now,
  onPickDay,
  onShiftWeek,
}: {
  days: Date[];
  today: string;
  now: Date;
  onPickDay: (key: string) => void;
  /** Al arrastrar algo contra el borde derecho (o izquierdo), se pasa a la semana siguiente (o anterior). */
  onShiftWeek?: (n: 1 | -1) => void;
}) {
  const { c } = useTheme();
  const { t } = useT();
  const { height: winH, width: winW } = useWindowDimensions();
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const reminders = useStore((s) => s.reminders);
  const use24h = useStore((s) => s.settings.use24h);
  const updateEvent = useStore((s) => s.updateEvent);
  const addEvent = useStore((s) => s.addEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const skipOccurrence = useStore((s) => s.skipOccurrence);
  const updateTask = useStore((s) => s.updateTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const updateReminder = useStore((s) => s.updateReminder);
  const addTask = useStore((s) => s.addTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const addReminder = useStore((s) => s.addReminder);
  const deleteReminder = useStore((s) => s.deleteReminder);
  const [menu, setMenu] = useState<Menu | null>(null);

  const keys = useMemo(() => days.map(toKey), [days]);
  // Los manejadores del arrastre se crean al empezar: leen la semana actual de aquí (puede cambiar mientras tanto).
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const shiftRef = useRef(onShiftWeek);
  shiftRef.current = onShiftWeek;
  const pointer = useRef({ x: 0, y: 0 });
  const edgeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const edgeSince = useRef(0);

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
        const base = { key: `t-${x.id}`, kind: 'task' as const, id: x.id, day, title: x.title, color: x.priority === 2 ? c.danger : c.textMuted, occ: k, done: x.done, priority: x.priority, col: 0, cols: 1 };
        if (x.time) {
          const s = timeToMinutes(x.time);
          timed[day].push({ ...base, start: s, dur: clamp(x.duration ?? TASK_DUR, SNAP, DAY_MIN - s), allDay: false });
        } else allDay[day].push({ ...base, start: 0, dur: 0, allDay: true });
      }
      layoutDay(timed[day]);
      allDay[day].sort((a, b) => Number(a.kind === 'task') - Number(b.kind === 'task') || Number(!!a.done) - Number(!!b.done));
    });
    return { timed, allDay };
  }, [keys, events, reminders, tasks, c.accent, c.textMuted, c.danger]);

  const gridRef = useRef<View>(null);
  const allDayRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Pos | null>(null);
  const dragPos = useRef<Pos | null>(null);
  const [create, setCreate] = useState<Create | null>(null);
  const createPos = useRef<Create | null>(null);
  const createRef = useRef<{ x0: number; y0: number; day: number; anchor: number; moved: boolean; area: Area } | null>(null);
  const [undo, setUndo] = useState<{ msg: string; run: () => void; id: number } | null>(null);

  const wrapRef = useRef<View>(null);
  useEffect(() => {
    const node = el(wrapRef.current) as HTMLElement | null;
    if (!node) return;
    const block = (e: Event) => e.preventDefault();
    node.addEventListener('contextmenu', block);
    return () => node.removeEventListener('contextmenu', block);
  }, []);

  // Al abrir: la cuadrícula empieza un par de horas antes de la hora actual.
  useEffect(() => {
    const y = Math.max(0, (new Date().getHours() - 2) * HOUR_H - 10);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    return () => clearTimeout(id);
  }, []);

  // El aviso de «Deshacer» se va solo; mientras está, Ctrl+Z también deshace.
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo((u) => (u && u.id === undo.id ? null : u)), 7000);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        undo.run();
        setUndo(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [undo]);

  const offerUndo = (msg: string, run: () => void) => setUndo({ msg, run, id: Date.now() });

  const scrollNode = () => el((scrollRef.current as unknown as { getScrollableNode?: () => unknown })?.getScrollableNode?.());

  const open = (it: Item) => {
    if (it.kind === 'event') router.push({ pathname: '/form/event', params: { id: it.id, occ: it.occ } });
    else if (it.kind === 'reminder') router.push({ pathname: '/form/reminder', params: { id: it.id } });
    else router.push({ pathname: '/form/task', params: { id: it.id } });
  };

  const commit = (it: Item, pos: Pos) => {
    const { day, start, dur, area, mode } = pos;
    const newKey = keysRef.current[day];
    const toAllDay = area === 'allday';
    if (newKey === it.occ && toAllDay === it.allDay && (toAllDay || (start === it.start && dur === it.dur))) return;
    const msg = t(mode === 'resize' ? 'cal.undoResized' : 'cal.undoMoved', { x: it.title });

    if (it.kind === 'task') {
      const prev = useStore.getState().tasks.find((x) => x.id === it.id);
      if (!prev) return;
      const before = { due: prev.due, time: prev.time ?? null, duration: prev.duration ?? null };
      updateTask(it.id, toAllDay ? { due: newKey, time: null, duration: null } : { due: newKey, time: minutesToTime(start), duration: dur });
      return offerUndo(msg, () => updateTask(it.id, before));
    }
    if (it.kind === 'reminder') {
      const prev = useStore.getState().reminders.find((r) => r.id === it.id);
      if (!prev) return;
      const d = fromKey(newKey);
      d.setHours(Math.floor(start / 60), start % 60, 0, 0);
      updateReminder(it.id, { at: d.getTime() });
      return offerUndo(msg, () => updateReminder(it.id, { at: prev.at }));
    }

    const ev = it.ev!;
    const before = { date: ev.date, start: ev.start, end: ev.end, exceptions: ev.exceptions ?? [] };
    const time = it.allDay ? {} : { start: minutesToTime(start), end: minutesToTime(Math.min(start + dur, DAY_MIN - 1)) };
    if (ev.repeat === 'none') {
      updateEvent(ev.id, { date: newKey, ...time });
      return offerUndo(msg, () => updateEvent(ev.id, { date: before.date, start: before.start, end: before.end }));
    }
    // Evento que se repite: cambiar solo esta vez o toda la serie.
    const delta = Math.round((fromKey(newKey).getTime() - fromKey(it.occ).getTime()) / 86_400_000);
    showDialog(t('cal.moveTitle'), t('cal.moveBody'), [
      {
        text: t('cal.moveOne'),
        onPress: async () => {
          const { id: _id, notificationIds: _n, ...rest } = ev;
          const known = new Set(useStore.getState().events.map((e) => e.id));
          await skipOccurrence(ev.id, it.occ);
          await addEvent({ ...rest, date: newKey, ...time, repeat: 'none', interval: 1, until: null, exceptions: [] });
          const created = useStore.getState().events.find((e) => !known.has(e.id));
          offerUndo(msg, async () => {
            if (created) await deleteEvent(created.id);
            await updateEvent(ev.id, { exceptions: before.exceptions });
          });
        },
      },
      {
        text: t('cal.moveAll'),
        onPress: async () => {
          await updateEvent(ev.id, { date: toKey(addDays(fromKey(ev.date), delta)), ...time });
          offerUndo(msg, () => updateEvent(ev.id, { date: before.date, start: before.start, end: before.end }));
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const autoScroll = (clientY: number) => {
    // Cerca del borde, la cuadrícula se desplaza sola.
    const sc = scrollNode();
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    if (clientY < r.top + 36 && clientY > r.top - 4) sc.scrollTop -= 14;
    else if (clientY > r.bottom - 36) sc.scrollTop += 14;
  };

  const dayAt = (clientX: number, box: DOMRect) => clamp(Math.floor((clientX - box.left - GUTTER) / ((box.width - GUTTER) / 7)), 0, 6);

  const onMove = (ev: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    pointer.current = { x: ev.clientX, y: ev.clientY };
    if (!d.moved && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 4) return;
    d.moved = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = d.mode === 'resize' ? 'ns-resize' : 'grabbing';
    const it = d.item;
    const gridBox = el(gridRef.current)?.getBoundingClientRect();
    const allBox = el(allDayRef.current)?.getBoundingClientRect();
    if (!gridBox || !allBox) return;

    let pos: Pos;
    if (d.mode === 'resize') {
      // Duración: del inicio hasta donde está el puntero, en cuartos de hora (mínimo 15 min, hasta las 23:59).
      const pointer = ((ev.clientY - gridBox.top) / HOUR_H) * 60;
      const dur = clamp(snap(pointer - it.start), SNAP, DAY_MIN - 1 - it.start);
      autoScroll(ev.clientY);
      pos = { key: it.key, item: it, day: it.day, start: it.start, dur, area: 'grid', mode: 'resize' };
    } else {
      // Las tareas pasan entre la franja de «todo el día» y las horas; lo demás se queda en su zona.
      let area: Area = it.allDay ? 'allday' : 'grid';
      if (it.kind === 'task') area = ev.clientY <= allBox.bottom ? 'allday' : 'grid';
      const day = dayAt(ev.clientX, area === 'allday' ? allBox : gridBox);
      let start = it.start;
      let dur = it.dur;
      if (area === 'grid') {
        if (it.allDay) dur = TASK_DUR; // una tarea sin hora entra con una hora de duración
        const grab = it.allDay ? SNAP : d.grab;
        const maxStart = Math.max(0, Math.floor((it.kind === 'reminder' ? DAY_MIN - SNAP : DAY_MIN - 1 - dur) / SNAP) * SNAP);
        start = clamp(snap(((ev.clientY - gridBox.top) / HOUR_H) * 60 - grab), 0, maxStart);
        autoScroll(ev.clientY);
      }
      pos = { key: it.key, item: it, day, start, dur, area, mode: 'move' };
    }
    dragPos.current = pos;
    setDrag((p) => (p && p.key === pos.key && p.day === pos.day && p.start === pos.start && p.dur === pos.dur && p.area === pos.area ? p : pos));
  };

  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (edgeTimer.current) clearInterval(edgeTimer.current);
    edgeTimer.current = null;
    edgeSince.current = 0;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    const d = dragRef.current;
    const pos = dragPos.current;
    dragRef.current = null;
    dragPos.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) open(d.item);
    else if (pos) commit(d.item, pos);
  };

  const startDrag = (it: Item, e: PE, mode: 'move' | 'resize' = 'move') => {
    e.stopPropagation();
    if (e.nativeEvent.button === 2) return setMenu({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, item: it });
    if ((e.nativeEvent.button ?? 0) !== 0) return;
    let grab = 0;
    if (!it.allDay) {
      const box = el(gridRef.current)?.getBoundingClientRect();
      if (box) grab = ((e.nativeEvent.clientY - box.top) / HOUR_H) * 60 - it.start;
    }
    dragRef.current = { item: it, x0: e.nativeEvent.clientX, y0: e.nativeEvent.clientY, grab, moved: false, mode };
    pointer.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // Mantenerlo contra el borde derecho o izquierdo un momento cambia de semana (y se puede seguir arrastrando).
    if (mode === 'move' && shiftRef.current) {
      edgeTimer.current = setInterval(() => {
        const d = dragRef.current;
        const box = el(gridRef.current)?.getBoundingClientRect();
        if (!d || !d.moved || !box) return;
        const x = pointer.current.x;
        const dir = x > box.right - 18 ? 1 : x < box.left + GUTTER - 6 ? -1 : 0;
        if (!dir) {
          edgeSince.current = 0;
          return;
        }
        if (!edgeSince.current) edgeSince.current = Date.now();
        else if (Date.now() - edgeSince.current > 650) {
          edgeSince.current = Date.now() + 250; // una pausa antes de la siguiente semana
          shiftRef.current?.(dir as 1 | -1);
        }
      }, 100);
    }
  };

  // Hueco vacío: clic = evento nuevo a esa hora; arrastrar = evento nuevo con ese rango.
  const minuteAt = (clientY: number, box: DOMRect) => clamp(((clientY - box.top) / HOUR_H) * 60, 0, DAY_MIN);

  const onCreateMove = (ev: PointerEvent) => {
    const cr = createRef.current;
    if (!cr || cr.area !== 'grid') return;
    if (!cr.moved && Math.abs(ev.clientY - cr.y0) < 6) return;
    cr.moved = true;
    document.body.style.userSelect = 'none';
    const box = el(gridRef.current)?.getBoundingClientRect();
    if (!box) return;
    const m = minuteAt(ev.clientY, box);
    const a = Math.floor(cr.anchor / SNAP) * SNAP;
    const from = Math.min(a, Math.floor(m / SNAP) * SNAP);
    const to = Math.max(a + SNAP, Math.ceil(m / SNAP) * SNAP);
    autoScroll(ev.clientY);
    const next = { day: cr.day, from, to: Math.min(to, DAY_MIN - 1) };
    createPos.current = next;
    setCreate((p) => (p && p.day === next.day && p.from === next.from && p.to === next.to ? p : next));
  };

  const onCreateUp = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', onCreateMove);
    window.removeEventListener('pointerup', onCreateUp);
    document.body.style.userSelect = '';
    const cr = createRef.current;
    createRef.current = null;
    if (!cr) return;
    if (cr.area === 'allday') {
      if (Math.hypot(ev.clientX - cr.x0, ev.clientY - cr.y0) <= 4) router.push({ pathname: '/form/event', params: { date: keys[cr.day] } });
      return;
    }
    const cur = createPos.current;
    createPos.current = null;
    setCreate(null);
    if (cr.moved && cur) {
      router.push({ pathname: '/form/event', params: { date: keys[cur.day], start: minutesToTime(cur.from), end: minutesToTime(cur.to) } });
    } else if (!cr.moved) {
      const start = clamp(Math.floor(cr.anchor / 30) * 30, 0, 23 * 60);
      router.push({ pathname: '/form/event', params: { date: keys[cr.day], start: minutesToTime(start) } });
    }
  };

  const bgPointerDown = (e: PE, area: Area) => {
    const box = el(area === 'grid' ? gridRef.current : allDayRef.current)?.getBoundingClientRect();
    if (!box || e.nativeEvent.clientX - box.left < GUTTER) return;
    if (e.nativeEvent.button === 2) {
      const start = area === 'grid' ? Math.floor(minuteAt(e.nativeEvent.clientY, box) / 30) * 30 : 0;
      return setMenu({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, slot: { day: dayAt(e.nativeEvent.clientX, box), start, area } });
    }
    if ((e.nativeEvent.button ?? 0) !== 0) return;
    createRef.current = {
      x0: e.nativeEvent.clientX,
      y0: e.nativeEvent.clientY,
      day: dayAt(e.nativeEvent.clientX, box),
      anchor: area === 'grid' ? minuteAt(e.nativeEvent.clientY, box) : 0,
      moved: false,
      area,
    };
    window.addEventListener('pointermove', onCreateMove);
    window.addEventListener('pointerup', onCreateUp);
  };

  /** Pega (o duplica) un elemento en un día y hora: crea una copia nueva, el original no cambia. */
  const pasteAt = async (src: Item, day: number, start: number, area: 'grid' | 'allday') => {
    const date = keys[day];
    const timed = area === 'grid';
    const dur = src.allDay ? 60 : src.dur;
    const end = Math.min(start + dur, DAY_MIN - 1);
    if (src.kind === 'event' && src.ev) {
      const { id: _id, notificationIds: _n, ...rest } = src.ev;
      const known = new Set(useStore.getState().events.map((e) => e.id));
      await addEvent({
        ...rest,
        date,
        ...(timed ? { allDay: false, start: minutesToTime(start), end: minutesToTime(end) } : { allDay: true }),
        repeat: 'none',
        interval: 1,
        until: null,
        exceptions: [],
      });
      const created = useStore.getState().events.find((e) => !known.has(e.id));
      offerUndo(t('cal.undoPasted', { x: src.title }), () => created && deleteEvent(created.id));
    } else if (src.kind === 'task') {
      const prev = useStore.getState().tasks.find((x) => x.id === src.id);
      const known = new Set(useStore.getState().tasks.map((x) => x.id));
      addTask({ title: src.title, priority: prev?.priority ?? 0, goalId: prev?.goalId ?? null, notes: prev?.notes ?? '', due: date, ...(timed ? { time: minutesToTime(start), duration: dur } : {}) });
      const created = useStore.getState().tasks.find((x) => !known.has(x.id));
      offerUndo(t('cal.undoPasted', { x: src.title }), () => created && deleteTask(created.id));
    } else if (src.kind === 'reminder') {
      const d = fromKey(date);
      d.setHours(Math.floor(start / 60), start % 60, 0, 0);
      const known = new Set(useStore.getState().reminders.map((r) => r.id));
      await addReminder({ title: src.title, at: d.getTime() });
      const created = useStore.getState().reminders.find((r) => !known.has(r.id));
      offerUndo(t('cal.undoPasted', { x: src.title }), () => created && deleteReminder(created.id));
    }
  };

  const remove = (it: Item) => {
    const run = async () => {
      if (it.kind === 'task') deleteTask(it.id);
      else if (it.kind === 'reminder') await deleteReminder(it.id);
      else await deleteEvent(it.id);
    };
    if (it.kind === 'event' && it.ev && it.ev.repeat !== 'none') {
      return showDialog(t('cal.deleteTitle'), it.title, [
        { text: t('cal.deleteOne'), onPress: () => skipOccurrence(it.id, it.occ) },
        { text: t('cal.deleteAll'), style: 'destructive', onPress: run },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
    showDialog(t('cal.deleteTitle'), it.title, [
      { text: t('common.delete'), style: 'destructive', onPress: run },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const menuItems = (m: Menu): { icon: IconName; label: string; run: () => void; danger?: boolean; disabled?: boolean }[] => {
    if (m.item) {
      const it = m.item;
      const area = it.allDay ? 'allday' : 'grid';
      return [
        { icon: 'edit-2', label: t('cal.menuEdit'), run: () => open(it) },
        { icon: 'copy', label: t('cal.menuCopy'), run: () => (copied = it) },
        { icon: 'layers', label: t('cal.menuDuplicate'), run: () => pasteAt(it, it.day, it.start, area) },
        ...(it.day < 6 ? [{ icon: 'chevron-right' as IconName, label: t('cal.menuNextDay'), run: () => pasteAt(it, it.day + 1, it.start, area) }] : []),
        ...(it.kind === 'task' ? [{ icon: 'check-circle' as IconName, label: it.done ? t('cal.menuUndone') : t('cal.menuDone'), run: () => toggleTask(it.id) }] : []),
        { icon: 'trash-2', label: t('common.delete'), run: () => remove(it), danger: true },
      ];
    }
    const slot = m.slot!;
    return [
      {
        icon: 'plus',
        label: t('cal.newEvent'),
        run: () => router.push({ pathname: '/form/event', params: { date: keys[slot.day], ...(slot.area === 'grid' ? { start: minutesToTime(slot.start) } : {}) } }),
      },
      {
        icon: 'clipboard',
        label: copied ? t('cal.menuPaste', { x: copied.title }) : t('cal.menuPasteEmpty'),
        run: () => copied && pasteAt(copied, slot.day, slot.start, copied.kind === 'event' && copied.allDay ? 'allday' : slot.area),
        disabled: !copied,
      },
    ];
  };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx = keys.indexOf(today);
  // Hueco extra en la franja de arriba si se está soltando ahí una tarea que tenía hora.
  // Si se pasó a otra semana, el original no está en esta: se dibuja la copia que se arrastra.
  const visible = !drag || timed.some((l) => l.some((x) => x.key === drag.key)) || allDay.some((l) => l.some((x) => x.key === drag.key));
  const ghostAllDay = drag && (drag.area === 'allday' && (!drag.item.allDay || !visible)) ? drag : null;
  const ghostGrid = drag && (drag.area === 'grid' && (drag.item.allDay || !visible)) ? drag : null;
  const rowMax = Math.max(1, ...allDay.map((l, i) => l.length + (ghostAllDay && ghostAllDay.day === i ? 1 : 0)));
  // La semana cabe en la ventana: solo se desplazan las horas.
  const gridH = Math.max(320, winH - 450 - Math.max(1, ...allDay.map((l) => l.length)) * CHIP_H);

  /** Posición mientras se arrastra (o la normal). */
  const place = (it: Item, ghost = false) => {
    const own = drag && drag.key === it.key;
    // El original queda tenue mientras su copia se suelta en la otra zona.
    const elsewhere = own && !ghost && (drag.area === 'allday') !== it.allDay;
    if (own && !elsewhere) return { day: drag.day, start: drag.start, dur: drag.dur, dragging: true, resizing: drag.mode === 'resize', faded: false };
    return { day: it.day, start: it.start, dur: it.dur, dragging: false, resizing: false, faded: !!elsewhere };
  };

  const renderTimed = (it: Item, ghost = false) => {
    const p = place(it, ghost);
    const top = (p.start / 60) * HOUR_H;
    const h = Math.max(22, (p.dur / 60) * HOUR_H - 2);
    // Al moverlo ocupa todo el ancho del día; al cambiar su duración conserva su sitio.
    const w = p.dragging && !p.resizing ? 1 : 1 / it.cols;
    const left = p.dragging && !p.resizing ? 0 : it.col / it.cols;
    const isRem = it.kind === 'reminder';
    const isTask = it.kind === 'task';
    const label = isRem
      ? formatClock(new Date(2000, 0, 1, Math.floor(p.start / 60), p.start % 60), use24h)
      : `${formatTime(minutesToTime(p.start), use24h)} – ${formatTime(minutesToTime(Math.min(p.start + p.dur, DAY_MIN - 1)), use24h)}`;
    const tint = isTask ? c.textMuted : it.color;
    return (
      <PView
        key={ghost ? `${it.key}-ghost` : it.key}
        onPointerDown={(e: PE) => startDrag(it, e)}
        accessibilityRole="button"
        accessibilityLabel={`${it.title}, ${label}`}
        style={[
          styles.block,
          webGrab,
          {
            top: top + 1,
            height: h,
            left: colLeft(p.day + left),
            width: colWidth(w),
            backgroundColor: c.surface,
            borderColor: p.dragging ? it.color : c.border,
            opacity: p.faded ? 0.3 : it.done ? 0.55 : 1,
            zIndex: p.dragging ? 50 : 2,
          },
          p.dragging ? webLift : null,
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: isRem ? 0.1 : isTask ? 0.08 : 0.16, borderRadius: radius.sm - 1 }]} />
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: it.color }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {isRem ? <Icon name="bell" size={11} color={it.color} /> : null}
          {isTask ? (
            // El círculo marca la tarea como hecha sin empezar a arrastrar.
            <PView onPointerDown={(e: PE) => e.stopPropagation()}>
              <Checkbox checked={!!it.done} onToggle={() => toggleTask(it.id)} label={it.title} size={13} color={it.priority === 2 ? c.danger : undefined} />
            </PView>
          ) : null}
          {/* Título en dos líneas solo si cabe también la hora debajo (bloques de más de una hora). */}
          <Text variant="caption" numberOfLines={h > 64 ? 2 : 1} style={{ flex: 1, fontWeight: '600', color: c.text, textDecorationLine: it.done ? 'line-through' : 'none' }}>
            {it.title}
          </Text>
          {h < 44 && !p.resizing ? (
            <Text variant="caption" tabular numberOfLines={1} style={{ color: c.textMuted, fontSize: 11 }}>
              {formatTime(minutesToTime(p.start), use24h)}
            </Text>
          ) : null}
        </View>
        {h >= 44 || p.resizing ? (
          <Text variant="caption" tabular numberOfLines={1} style={{ color: c.textMuted, fontSize: 11 }}>
            {label}
          </Text>
        ) : null}
        {!isRem && !ghost ? (
          // Borde de abajo: se jala para alargar o acortar.
          <PView onPointerDown={(e: PE) => startDrag(it, e, 'resize')} accessibilityLabel={t('cal.resizeA11y')} style={[styles.resize, webResize]}>
            {h > 64 || p.resizing ? <View style={[styles.grip, { backgroundColor: it.color, opacity: p.resizing ? 0.9 : 0.45 }]} /> : null}
          </PView>
        ) : null}
      </PView>
    );
  };

  const renderAllDay = (it: Item, i: number, ghost = false) => {
    const p = place(it, ghost);
    const isTask = it.kind === 'task';
    return (
      <PView
        key={ghost ? `${it.key}-ghost` : it.key}
        onPointerDown={(e: PE) => startDrag(it, e)}
        accessibilityRole="button"
        accessibilityLabel={it.title}
        style={[
          styles.chip,
          webGrab,
          {
            top: 4 + i * CHIP_H,
            left: colLeft(p.day),
            width: colWidth(1),
            backgroundColor: isTask ? c.surfaceAlt : c.surface,
            borderColor: p.dragging ? c.accent : 'transparent',
            opacity: p.faded ? 0.3 : 1,
            zIndex: p.dragging ? 50 : 2,
          },
          p.dragging ? webLift : null,
        ]}
      >
        {isTask ? (
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
    <View ref={wrapRef}>
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

        {/* Franja de todo el día: eventos de día completo y tareas sin hora */}
        <PView
          ref={allDayRef}
          onPointerDown={(e: PE) => bgPointerDown(e, 'allday')}
          style={{ height: 8 + rowMax * CHIP_H, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, backgroundColor: ghostAllDay ? c.accentSoft : 'transparent' }}
        >
          {dayLines}
          <Text variant="caption" tone="faint" style={{ position: 'absolute', left: 6, top: 6, width: GUTTER - 10, fontSize: 10, lineHeight: 12 }}>
            {t('row.allDay')}
          </Text>
          {allDay.map((list) => list.map((it, i) => renderAllDay(it, i)))}
          {ghostAllDay ? renderAllDay(ghostAllDay.item, allDay[ghostAllDay.day].length, true) : null}
        </PView>

        {/* Cuadrícula de horas */}
        <ScrollView ref={scrollRef} style={{ height: gridH }} showsVerticalScrollIndicator>
          <PView ref={gridRef} onPointerDown={(e: PE) => bgPointerDown(e, 'grid')} style={{ height: 24 * HOUR_H }}>
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
            {timed.map((list) => list.map((it) => renderTimed(it)))}
            {ghostGrid ? renderTimed(ghostGrid.item, true) : null}
            {create ? (
              <View
                pointerEvents="none"
                style={[
                  styles.block,
                  {
                    top: (create.from / 60) * HOUR_H + 1,
                    height: Math.max(20, ((create.to - create.from) / 60) * HOUR_H - 2),
                    left: colLeft(create.day),
                    width: colWidth(1),
                    backgroundColor: c.accentSoft,
                    borderColor: c.accent,
                    borderStyle: 'dashed',
                    zIndex: 45,
                  },
                ]}
              >
                <Text variant="caption" style={{ fontWeight: '600', color: c.accent }}>
                  {t('cal.newEvent')}
                </Text>
                <Text variant="caption" tabular style={{ color: c.accent, fontSize: 11 }}>
                  {formatTime(minutesToTime(create.from), use24h)} – {formatTime(minutesToTime(create.to), use24h)}
                </Text>
              </View>
            ) : null}
          </PView>
        </ScrollView>
      </View>

      {/* Clic derecho: editar, copiar, pegar, duplicar, eliminar */}
      {menu ? (
        <Modal transparent visible animationType="none" onRequestClose={() => setMenu(null)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} accessibilityLabel={t('common.close')} />
          <Animated.View
            entering={FadeInDown.duration(motion.fast)}
            style={[styles.menu, { left: Math.min(menu.x, winW - 250), top: Math.min(menu.y, winH - 280), backgroundColor: c.elevated, borderColor: c.borderStrong }]}
          >
            {menuItems(menu).map((m) => (
              <Pressable
                key={m.label}
                disabled={m.disabled}
                onPress={() => {
                  setMenu(null);
                  m.run();
                }}
                accessibilityRole="menuitem"
                style={(st) => [styles.menuItem, { backgroundColor: (st as { hovered?: boolean }).hovered && !m.disabled ? c.surfaceAlt : 'transparent', opacity: m.disabled ? 0.45 : 1 }]}
              >
                <Icon name={m.icon} size={16} color={m.danger ? c.danger : c.textMuted} />
                <Text variant="body" numberOfLines={1} style={{ flex: 1, color: m.danger ? c.danger : c.text }}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </Modal>
      ) : null}

      {/* Deshacer el último cambio hecho arrastrando */}
      {undo ? (
        <Animated.View
          key={undo.id}
          entering={FadeInDown.duration(motion.base)}
          exiting={FadeOutDown.duration(motion.fast)}
          style={[styles.toast, { backgroundColor: c.text }]}
          accessibilityRole="alert"
        >
          <Text variant="caption" numberOfLines={1} style={{ color: c.bg, flexShrink: 1 }}>
            {undo.msg}
          </Text>
          <Pressable
            onPress={() => {
              undo.run();
              setUndo(null);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: 6, paddingVertical: 2 })}
          >
            <Text variant="caption" style={{ color: c.bg, fontWeight: '700' }}>
              {t('cal.undo')} <Text variant="caption" style={{ color: c.bg, opacity: 0.55 }}>Ctrl+Z</Text>
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const webGrab = { cursor: 'grab' } as object;
const webResize = { cursor: 'ns-resize' } as object;
const webLift = { boxShadow: '0 8px 24px rgba(0,0,0,0.22)' } as object;

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: 240,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 38 },
  wrap: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  head: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  headCell: { flex: 1, alignItems: 'center', gap: 2 },
  dayNum: { minWidth: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  block: { position: 'absolute', borderRadius: radius.sm, borderWidth: 1, paddingLeft: 8, paddingRight: 4, paddingVertical: 3, overflow: 'hidden', gap: 1 },
  resize: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  grip: { width: 18, height: 3, borderRadius: 2 },
  chip: { position: 'absolute', height: 22, borderRadius: radius.sm, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, overflow: 'hidden' },
  toast: {
    position: 'absolute',
    left: '50%',
    bottom: space.lg,
    transform: [{ translateX: '-50%' as unknown as number }],
    zIndex: 60,
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
});
