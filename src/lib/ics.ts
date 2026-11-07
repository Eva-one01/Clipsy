/**
 * Importar calendarios .ics (Google Calendar, Outlook, Apple Calendar…).
 * Lee VEVENT con DTSTART/DTEND (UTC, con TZID o «flotantes»), SUMMARY, DESCRIPTION, LOCATION,
 * RRULE (FREQ, INTERVAL, UNTIL, COUNT, BYDAY, BYMONTHDAY) y EXDATE. Las horas se pasan a la zona local.
 */
import type { CalendarEvent, DateKey, Repeat } from '@/store/types';
import { nextOccurrences } from './recurrence';
import { isValidTz, zoned } from './timezone';

export type IcsEvent = Omit<CalendarEvent, 'id' | 'notificationIds'>;

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date): DateKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hmOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): Prop | null {
  // NAME;PARAM=x;PARAM2="y:z":VALUE — los dos puntos dentro de comillas no cuentan.
  let i = 0;
  let quoted = false;
  for (; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ':' && !quoted) break;
  }
  if (i >= line.length) return null;
  const [name, ...rawParams] = line.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

/** Hora de pared en una zona IANA → instante real. */
function fromZone(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const wall = Date.UTC(y, mo, d, h, mi, s);
  let guess = wall;
  for (let k = 0; k < 2; k++) {
    const z = zoned(tz, new Date(guess));
    const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
    guess += wall - asUtc;
  }
  return new Date(guess);
}

/** Devuelve la fecha local y si es de día completo. */
function parseDate(p: Prop): { date: Date; allDay: boolean } | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, Y, Mo, D, h, mi, s, z] = m;
  const y = Number(Y);
  const mo = Number(Mo) - 1;
  const d = Number(D);
  if (!h || p.params.VALUE === 'DATE') return { date: new Date(y, mo, d), allDay: true };
  if (z) return { date: new Date(Date.UTC(y, mo, d, Number(h), Number(mi), Number(s ?? 0))), allDay: false };
  const tz = p.params.TZID;
  if (tz && isValidTz(tz)) return { date: fromZone(y, mo, d, Number(h), Number(mi), Number(s ?? 0), tz), allDay: false };
  // Hora «flotante» (o zona de Windows que no reconocemos): se toma como hora local.
  return { date: new Date(y, mo, d, Number(h), Number(mi), Number(s ?? 0)), allDay: false };
}

function parseRule(rule: string, start: Date): { repeat: Repeat; interval: number; until: DateKey | null; count: number | null; lossy: boolean } {
  const r: Record<string, string> = {};
  for (const part of rule.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) r[k.toUpperCase()] = v.toUpperCase();
  }
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  let until: DateKey | null = null;
  if (r.UNTIL) {
    const u = parseDate({ name: 'UNTIL', params: {}, value: r.UNTIL });
    if (u) until = keyOf(u.date);
  }
  const count = r.COUNT ? Number(r.COUNT) : null;
  const byday = r.BYDAY ? r.BYDAY.split(',') : [];
  let repeat: Repeat = 'none';
  let lossy = false;
  switch (r.FREQ) {
    case 'DAILY':
      repeat = 'daily';
      break;
    case 'WEEKLY': {
      const days = new Set(byday.map((x) => x.slice(-2)));
      if (days.size === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every((x) => days.has(x)) && interval === 1) repeat = 'weekdays';
      else {
        repeat = 'weekly';
        lossy = days.size > 1 || (days.size === 1 && !days.has(DOW[start.getDay()]));
      }
      break;
    }
    case 'MONTHLY': {
      const nth = byday[0]?.match(/^([+-]?\d)([A-Z]{2})$/);
      if (r.BYMONTHDAY === '-1') repeat = 'monthlyLast';
      else if (nth) {
        repeat = 'monthlyNth';
        lossy = nth[2] !== DOW[start.getDay()];
      } else repeat = 'monthly';
      break;
    }
    case 'YEARLY':
      repeat = 'yearly';
      break;
    default:
      lossy = !!r.FREQ;
  }
  return { repeat, interval, until, count, lossy };
}

export interface IcsResult {
  events: IcsEvent[];
  /** Repeticiones que no se pueden representar igual (p. ej. «lunes y miércoles»): se importan simplificadas. */
  simplified: number;
  /** Eventos antiguos (de hace más de un año) que se omiten. */
  skippedOld: number;
}

export function parseIcs(text: string, color: string, now = new Date()): IcsResult {
  const lines = unfold(text);
  const out: IcsResult = { events: [], simplified: 0, skippedOld: 0 };
  const cutoff = keyOf(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
  let cur: Prop[] | null = null;
  let depth = 0; // ignora VALARM y otros bloques dentro del evento

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    const up = line.toUpperCase();
    if (up === 'BEGIN:VEVENT') {
      cur = [];
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (up.startsWith('BEGIN:')) {
      depth++;
      continue;
    }
    if (up.startsWith('END:') && depth > 0) {
      depth--;
      continue;
    }
    if (up === 'END:VEVENT') {
      const ev = toEvent(cur, color, cutoff, out);
      if (ev) out.events.push(ev);
      cur = null;
      continue;
    }
    if (depth === 0) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }
  return out;
}

function toEvent(props: Prop[], color: string, cutoff: DateKey, out: IcsResult): IcsEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const status = get('STATUS')?.value.toUpperCase();
  if (status === 'CANCELLED') return null;
  // Las modificaciones sueltas de una serie (RECURRENCE-ID) se importan como eventos normales.
  const ds = get('DTSTART');
  const start = ds ? parseDate(ds) : null;
  if (!start) return null;
  const de = get('DTEND');
  let end = de ? parseDate(de) : null;
  const dur = get('DURATION')?.value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!end && dur) {
    const ms = ((Number(dur[1] ?? 0) * 24 + Number(dur[2] ?? 0)) * 60 + Number(dur[3] ?? 0)) * 60_000;
    end = { date: new Date(start.date.getTime() + ms), allDay: start.allDay };
  }

  const title = unescape(get('SUMMARY')?.value ?? '') || '—';
  const location = unescape(get('LOCATION')?.value ?? '');
  const description = unescape(get('DESCRIPTION')?.value ?? '');
  const notes = [location, description].filter(Boolean).join('\n\n').slice(0, 4000);

  const date = keyOf(start.date);
  const sameDay = end && keyOf(end.date) === date;
  const ev: IcsEvent = {
    title: title.slice(0, 200),
    date,
    allDay: start.allDay,
    start: start.allDay ? '09:00' : hmOf(start.date),
    end: start.allDay ? '10:00' : end && sameDay ? hmOf(end.date) : end ? '23:59' : hmOf(new Date(start.date.getTime() + 3_600_000)),
    color,
    notes,
    repeat: 'none',
    remindBefore: null,
  };
  if (!ev.allDay && ev.end <= ev.start) ev.end = ev.start === '23:59' ? '23:59' : hmOf(new Date(start.date.getTime() + 3_600_000));

  const rrule = get('RRULE');
  if (rrule) {
    const r = parseRule(rrule.value, start.date);
    if (r.lossy) out.simplified++;
    if (r.repeat !== 'none') {
      ev.repeat = r.repeat;
      if (r.interval > 1) ev.interval = r.interval;
      if (r.until) ev.until = r.until;
      const ex = props
        .filter((p) => p.name === 'EXDATE')
        .flatMap((p) => p.value.split(',').map((v) => parseDate({ ...p, value: v })))
        .filter((x): x is { date: Date; allDay: boolean } => !!x)
        .map((x) => keyOf(x.date));
      if (ex.length) ev.exceptions = [...new Set(ex)];
      if (r.count && !r.until) {
        const occ = nextOccurrences({ ...ev, id: '', notificationIds: [] }, ev.date, r.count, 366 * 30);
        if (occ.length) ev.until = occ[occ.length - 1];
      }
    }
  }

  const lastDay = ev.repeat === 'none' ? ev.date : ev.until ?? '9999-12-31';
  if (lastDay < cutoff) {
    out.skippedOld++;
    return null;
  }
  return ev;
}
