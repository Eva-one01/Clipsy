/**
 * Repeticiones de eventos: diarias, laborables, semanales, mensuales (mismo día, «el segundo martes»,
 * «el último día»), anuales; cada N periodos, hasta una fecha y con excepciones (fechas saltadas).
 */
import type { CalendarEvent, DateKey } from '@/store/types';

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date): DateKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (k: DateKey) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/** 1 = primero … 4 = cuarto, 5 = último (de ese día de la semana en el mes). */
export function nthOfMonth(d: Date): number {
  const n = Math.ceil(d.getDate() / 7);
  const isLast = d.getDate() + 7 > daysInMonth(d.getFullYear(), d.getMonth());
  return isLast && n >= 4 ? 5 : n;
}

export function isLastDayOfMonth(d: Date) {
  return d.getDate() === daysInMonth(d.getFullYear(), d.getMonth());
}

/** ¿Ocurre el evento en esa fecha? */
export function occursOn(e: CalendarEvent, key: DateKey): boolean {
  if (key < e.date) return false;
  if (e.until && key > e.until) return false;
  if (e.exceptions?.includes(key)) return false;
  if (key === e.date) return true;
  const start = dateOf(e.date);
  const d = dateOf(key);
  const every = Math.max(1, e.interval ?? 1);
  switch (e.repeat) {
    case 'daily':
      return daysBetween(start, d) % every === 0;
    case 'weekdays':
      return d.getDay() >= 1 && d.getDay() <= 5;
    case 'weekly':
      return d.getDay() === start.getDay() && (daysBetween(start, d) / 7) % every === 0;
    case 'monthly': {
      if (monthsBetween(start, d) % every !== 0) return false;
      // El día 31 en meses cortos cae en el último día del mes.
      return d.getDate() === Math.min(start.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
    }
    case 'monthlyNth': {
      if (monthsBetween(start, d) % every !== 0 || d.getDay() !== start.getDay()) return false;
      const n = nthOfMonth(start);
      return n === 5 ? d.getDate() + 7 > daysInMonth(d.getFullYear(), d.getMonth()) : Math.ceil(d.getDate() / 7) === n;
    }
    case 'monthlyLast':
      return monthsBetween(start, d) % every === 0 && isLastDayOfMonth(d);
    case 'yearly': {
      if ((d.getFullYear() - start.getFullYear()) % every !== 0 || d.getMonth() !== start.getMonth()) return false;
      return d.getDate() === Math.min(start.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
    }
    default:
      return false;
  }
}

/** Próximas fechas en que ocurre (desde `from` incluida), como máximo `count` y dentro de `horizonDays`. */
export function nextOccurrences(e: CalendarEvent, from: DateKey, count: number, horizonDays = 400): DateKey[] {
  const out: DateKey[] = [];
  const d = dateOf(from < e.date ? e.date : from);
  for (let i = 0; i <= horizonDays && out.length < count; i++) {
    const k = keyOf(d);
    if (e.until && k > e.until) break;
    if (occursOn(e, k)) out.push(k);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Las repeticiones simples se programan con avisos repetitivos del sistema; el resto, fecha a fecha. */
export function isSimpleRepeat(e: CalendarEvent): boolean {
  return (
    ['none', 'daily', 'weekdays', 'weekly'].includes(e.repeat) &&
    (e.interval ?? 1) === 1 &&
    !e.until &&
    !(e.exceptions && e.exceptions.length)
  );
}

/** Próximas fechas de cobro de un gasto/ingreso fijo (sin contar el mes ya registrado). */
export function nextCharges(r: { day: number; lastPosted: string | null }, count = 2, now = new Date()): Date[] {
  const out: Date[] = [];
  for (let i = 0; out.length < count && i < count + 2; i++) {
    const y = now.getFullYear();
    const m = now.getMonth() + i;
    const first = new Date(y, m, 1);
    const day = Math.min(r.day, daysInMonth(first.getFullYear(), first.getMonth()));
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    if (ym === r.lastPosted) continue;
    if (keyOf(d) < keyOf(now)) continue;
    out.push(d);
  }
  return out;
}
