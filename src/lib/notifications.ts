/**
 * Notificaciones de la app de escritorio (Electron).
 *
 * Se mantiene un registro en memoria y un temporizador que dispara notificaciones nativas del sistema
 * (API Notification del navegador, que Electron convierte en avisos de Windows/macOS).
 * La app de escritorio sigue viva en la bandeja al cerrar la ventana, así que los avisos
 * llegan mientras Clipsy esté abierto. Al arrancar, el layout raíz reprograma todo.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { auxWindow } from '@/desktop/auxWindow';
import { desktop } from '@/desktop/bridge';
import { t } from '@/i18n';
import type { Alarm, CalendarEvent, RecurringTx, Reminder } from '@/store/types';
import { isSimpleRepeat, nextCharges, nextOccurrences } from './recurrence';
import { formatMoney } from './money';
import { useStore } from '@/store';
import { formatLead, formatTime, fromKey, timeToMinutes, todayKey } from './date';

export const CHANNEL_ALARMS = 'alarms';
export const CHANNEL_REMINDERS = 'reminders';

type Kind = 'alarm' | 'reminder' | 'event';

type Trigger =
  | { type: 'date'; at: number }
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number }; // 0 = domingo

interface Scheduled {
  id: string;
  title: string;
  body: string;
  kind: Kind;
  trigger: Trigger;
  next: number;
}

const registry = new Map<string, Scheduled>();
let timer: ReturnType<typeof setInterval> | null = null;
let seq = 0;
const TICK_MS = 5000;
const CLICK_EVENT = 'razor:notification-click';

function nextFire(tr: Trigger, from: number): number {
  if (tr.type === 'date') return tr.at;
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(tr.hour, tr.minute, 0, 0);
  if (tr.type === 'daily') {
    if (d.getTime() <= from) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  let add = (tr.weekday - d.getDay() + 7) % 7;
  if (add === 0 && d.getTime() <= from) add = 7;
  d.setDate(d.getDate() + add);
  return d.getTime();
}

function fire(s: Scheduled) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(s.title, { body: s.body, tag: s.id, silent: false, requireInteraction: s.kind === 'alarm' });
    n.onclick = () => {
      window.focus();
      desktop?.focus();
      window.dispatchEvent(new CustomEvent(CLICK_EVENT, { detail: { kind: s.kind } }));
      n.close();
    };
  } catch {
    // Sin soporte de notificaciones: se ignora sin romper la app.
  }
}

function tick() {
  const now = Date.now();
  for (const s of registry.values()) {
    if (s.next > now) continue;
    // Si el ordenador estuvo suspendido mucho tiempo, no se dispara un aviso de hace horas.
    if (now - s.next < 10 * 60_000) fire(s);
    if (s.trigger.type === 'date') registry.delete(s.id);
    else s.next = nextFire(s.trigger, now + 1000);
  }
}

function ensureTimer() {
  if (timer || typeof window === 'undefined') return;
  timer = setInterval(tick, TICK_MS);
}

function schedule(title: string, body: string, kind: Kind, trigger: Trigger): string | null {
  // Las ventanas auxiliares no avisan: la principal reprograma todo al ver el cambio.
  if (auxWindow) return null;
  const next = nextFire(trigger, Date.now());
  if (trigger.type === 'date' && next <= Date.now()) return null;
  const id = `desk-${Date.now().toString(36)}-${(seq++).toString(36)}`;
  registry.set(id, { id, title, body, kind, trigger, next });
  ensureTimer();
  return id;
}

export async function configureNotifications() {
  if (auxWindow) return;
  ensureTimer();
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission === 'default' ? 'undetermined' : (Notification.permission as PermissionState);
}

export async function ensurePermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function cancelMany(ids: string[]) {
  ids.forEach((id) => registry.delete(id));
}

export async function cancelAll() {
  registry.clear();
}

function hm(tm: string) {
  const m = timeToMinutes(tm);
  return { hour: Math.floor(m / 60), minute: m % 60 };
}

function use24h(): boolean {
  try {
    return useStore.getState().settings.use24h;
  } catch {
    return true;
  }
}

const keep = (ids: (string | null)[]) => ids.filter((x): x is string => x !== null);

export async function scheduleAlarm(alarm: Alarm): Promise<string[]> {
  if (!alarm.enabled) return [];
  const { hour, minute } = hm(alarm.time);
  const title = alarm.label || t('notif.alarm');
  const body = t('notif.alarmBody', { t: formatTime(alarm.time, use24h()) });
  if (alarm.days.length === 0 || alarm.days.length === 7) {
    return keep([schedule(title, body, 'alarm', { type: 'daily', hour, minute })]);
  }
  return keep(alarm.days.map((d) => schedule(title, body, 'alarm', { type: 'weekly', weekday: d, hour, minute })));
}

export async function scheduleReminder(r: Reminder): Promise<string[]> {
  if (r.done || r.at <= Date.now()) return [];
  return keep([schedule(r.title, t('notif.reminder'), 'reminder', { type: 'date', at: r.at })]);
}

export async function scheduleEventReminder(e: CalendarEvent): Promise<string[]> {
  if (e.remindBefore === null) return [];
  const startMin = e.allDay ? 9 * 60 : timeToMinutes(e.start);
  const safeMin = Math.max(0, startMin - e.remindBefore);
  const hour = Math.floor(safeMin / 60);
  const minute = safeMin % 60;
  const lead = e.remindBefore === 0 ? t('notif.startsNow') : t('notif.startsIn', { x: formatLead(e.remindBefore) });
  const body = e.allDay ? t('common.today') : lead;

  if (!isSimpleRepeat(e)) {
    const at = nextOccurrences(e, todayKey(), 12, 200).map((k) => {
      const d = fromKey(k);
      d.setHours(hour, minute, 0, 0);
      return d.getTime();
    });
    return keep(at.map((ms) => schedule(e.title, body, 'event', { type: 'date', at: ms })));
  }
  if (e.repeat === 'none') {
    const date = fromKey(e.date);
    date.setHours(hour, minute, 0, 0);
    return keep([schedule(e.title, body, 'event', { type: 'date', at: date.getTime() })]);
  }
  if (e.repeat === 'daily') return keep([schedule(e.title, body, 'event', { type: 'daily', hour, minute })]);
  const days = e.repeat === 'weekdays' ? [1, 2, 3, 4, 5] : [fromKey(e.date).getDay()];
  return keep(days.map((d) => schedule(e.title, body, 'event', { type: 'weekly', weekday: d, hour, minute })));
}

/** Aviso el día antes de un gasto o ingreso fijo, a las 9:00. */
export async function scheduleRecurringReminder(r: RecurringTx): Promise<string[]> {
  if (!r.active || !r.remind) return [];
  const currency = useStore.getState().settings.currency;
  const title = r.note || t(r.type === 'income' ? 'rec.notifIncome' : 'rec.notifExpense');
  const body = t('rec.notifBody', { x: formatMoney(r.amount, currency) });
  const at = nextCharges(r, 2).map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 9, 0, 0).getTime());
  return keep(at.map((ms) => schedule(title, body, 'reminder', { type: 'date', at: ms })));
}

/** En escritorio no hay canales de notificación que renombrar. */
export async function relabelChannels() {}

/** Al hacer clic en una notificación, abre la sección correspondiente. */
export function useNotificationRouting(ready: boolean) {
  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    const onClick = (ev: Event) => {
      const kind = (ev as CustomEvent<{ kind: Kind }>).detail?.kind;
      if (kind === 'event') router.navigate('/calendar');
      else if (kind === 'alarm' || kind === 'reminder') router.navigate('/alarms');
    };
    window.addEventListener(CLICK_EVENT, onClick);
    return () => window.removeEventListener(CLICK_EVENT, onClick);
  }, [ready]);
}
