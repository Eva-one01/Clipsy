import { t } from '@/i18n';

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface ZonedTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zoned(tz: string, at = new Date()): ZonedTime {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(at)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Minutos de diferencia entre la zona `tz` y la hora local del dispositivo. */
export function offsetFromLocal(tz: string, at = new Date()): number {
  const z = zoned(tz, at);
  const asUTC = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute);
  const local = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes());
  return Math.round((asUTC - local) / 60_000);
}

export function formatOffset(min: number): string {
  if (min === 0) return t('clocks.local');
  const sign = min > 0 ? '+' : '−';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''} h`;
}

/** -1 = ayer, 0 = hoy, 1 = mañana respecto a la fecha local. */
export function dayRelation(tz: string, at = new Date()): -1 | 0 | 1 {
  const z = zoned(tz, at);
  const a = Date.UTC(z.year, z.month - 1, z.day);
  const b = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());
  const d = Math.round((a - b) / 86_400_000);
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}

export function dayRelationLabel(rel: -1 | 0 | 1): string {
  return rel === 1 ? t('common.tomorrow') : rel === -1 ? t('common.yesterday') : t('common.today');
}

export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isNight(tz: string, at = new Date()) {
  const h = zoned(tz, at).hour;
  return h < 6 || h >= 20;
}
