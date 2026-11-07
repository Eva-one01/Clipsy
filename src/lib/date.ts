import { intlLocale, t } from '@/i18n';
import type { CalendarEvent, DateKey, TimeHM } from '@/store/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86_400_000);
}

/** 6 semanas x 7 días para la cuadrícula del mes. */
export function monthMatrix(year: number, month: number, weekStartsMonday: boolean): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay();
  const start = addDays(first, -startOffset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/* Formateadores en caché por locale (crear Intl.DateTimeFormat es caro). */
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const loc = intlLocale();
  const key = loc + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(loc, opts);
    } catch {
      f = new Intl.DateTimeFormat('en', opts);
    }
    fmtCache.set(key, f);
  }
  return f;
}

/** 2026-10-04 es domingo: base para nombres de días localizados. */
const SUNDAY = new Date(2026, 9, 4);

/** Nombre del día 0=domingo…6=sábado en el estilo pedido. */
export function weekdayName(day: number, style: 'narrow' | 'short' | 'long' = 'short'): string {
  return cap(fmt({ weekday: style }).format(addDays(SUNDAY, day)).replace('.', ''));
}

export function weekdayLabels(weekStartsMonday: boolean): string[] {
  const order = weekStartsMonday ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  return order.map((d) => weekdayName(d, 'narrow'));
}

export function formatLongDate(d: Date): string {
  return cap(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d));
}

export function formatMonthTitle(d: Date): string {
  return cap(fmt({ month: 'long', year: 'numeric' }).format(d));
}

export function formatShortDate(d: Date): string {
  return fmt({ day: 'numeric', month: 'short' }).format(d).replace('.', '');
}

export function formatDateTime(at: number | Date, use24h: boolean): string {
  return fmt({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: !use24h }).format(at);
}

export function formatClock(at: number | Date, use24h: boolean): string {
  return fmt({ hour: '2-digit', minute: '2-digit', hour12: !use24h }).format(at);
}

/** "Hoy", "Mañana", "Ayer", nombre del día (próxima semana) o fecha corta */
export function relativeDay(key: DateKey): string {
  const n = diffDays(key, todayKey());
  if (n === 0) return t('common.today');
  if (n === 1) return t('common.tomorrow');
  if (n === -1) return t('common.yesterday');
  if (n > 1 && n < 7) return cap(fmt({ weekday: 'long' }).format(fromKey(key)));
  return formatShortDate(fromKey(key));
}

export function timeToMinutes(tm: TimeHM): number {
  const [h, m] = tm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): TimeHM {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function dateToTime(d: Date): TimeHM {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function timeToDate(tm: TimeHM, base = new Date()): Date {
  const [h, m] = tm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Hora en formato 24 h o 12 h según el idioma (a. m., AM, …). */
export function formatTime(tm: TimeHM, use24h: boolean): string {
  if (use24h) return tm;
  return formatClock(timeToDate(tm), false);
}

/** Separa "7:00 AM" en ["7:00", "AM"] para tipografía distinta. */
export function splitTime(tm: TimeHM, use24h: boolean): [string, string] {
  const s = formatTime(tm, use24h);
  if (use24h) return [s, ''];
  const m = s.match(/^([\d:.\s]+?)\s*([^\d\s:.].*)$/);
  return m ? [m[1].trim(), m[2].trim()] : [s, ''];
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return t('greet.night');
  if (h < 12) return t('greet.morning');
  if (h < 19) return t('greet.afternoon');
  return t('greet.evening');
}

/** ¿El evento ocurre en esta fecha? Tiene en cuenta repeticiones y excepciones. */
export { occursOn } from './recurrence';
import { occursOn } from './recurrence';

export function eventsOn(events: CalendarEvent[], key: DateKey): CalendarEvent[] {
  return events
    .filter((e) => occursOn(e, key))
    .sort((a, b) => (a.allDay === b.allDay ? timeToMinutes(a.start) - timeToMinutes(b.start) : a.allDay ? -1 : 1));
}

/** Texto de la repetición; con la fecha de inicio, concreta el día («segundo martes», «15 de marzo»). */
export function repeatLabel(r: CalendarEvent['repeat'], start?: DateKey, interval = 1): string {
  const d = start ? fromKey(start) : null;
  const unit = r === 'daily' ? 'daily' : r === 'weekly' ? 'weekly' : r === 'yearly' ? 'yearly' : 'monthly';
  const base = interval > 1 && r !== 'none' && r !== 'weekdays' ? t(`ev.every.${unit}` as const, { n: interval }) : t(`repeat.${r}` as const);
  const detail = d ? repeatDetail(r, d) : '';
  return detail ? `${base} · ${detail}` : base;
}

/** «segundo», «último»… para el día de la semana de esa fecha dentro del mes. */
export function nthLabel(d: Date): string {
  const n = Math.ceil(d.getDate() / 7);
  const last = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return t(`nth.${(last && n >= 4 ? 5 : n) as 1 | 2 | 3 | 4 | 5}`);
}

function repeatDetail(r: CalendarEvent['repeat'], d: Date): string {
  const wd = weekdayName(d.getDay(), 'long');
  const lower = intlLocale().startsWith('de') ? wd : wd.toLowerCase();
  if (r === 'monthly') return t('repeat.dayOfMonth', { n: d.getDate() });
  if (r === 'yearly') return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' }).format(d);
  if (r === 'monthlyNth') return `${nthLabel(d)} ${lower}`;
  return '';
}

export function describeDays(days: number[]): string {
  if (days.length === 0 || days.length === 7) return t('days.every');
  const s = [...days].sort().join(',');
  if (s === '1,2,3,4,5') return t('days.weekdays');
  if (s === '0,6') return t('days.weekends');
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.filter((d) => days.includes(d)).map((d) => weekdayName(d, 'short')).join(' · ');
}

/** Duración corta localizada: 15 min, 1 h, 1 d… */
export function formatLead(min: number): string {
  if (min < 60) return t('lead.min', { n: min });
  if (min % 1440 === 0) return t('lead.d', { n: min / 1440 });
  if (min % 60 === 0) return t('lead.h', { n: min / 60 });
  return `${t('lead.h', { n: Math.floor(min / 60) })} ${t('lead.min', { n: min % 60 })}`;
}
