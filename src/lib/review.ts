import { diffDays, toKey } from './date';

/** ¿Toca revisión semanal? Cada 7 días; la primera vez, de viernes a domingo. */
export function reviewDue(last: string | null | undefined, now = new Date()) {
  if (!last) return [0, 5, 6].includes(now.getDay());
  return diffDays(toKey(now), last) >= 7;
}
