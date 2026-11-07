import { useEffect } from 'react';
import { t } from '@/i18n';
import { addDays, eventsOn, formatClock, relativeDay, toKey } from '@/lib/date';
import { useStore } from '@/store';
import type { Alarm } from '@/store/types';
import { desktop } from './bridge';

const HORIZON = 48 * 3_600_000;

function nextAlarm(a: Alarm, now: Date): number | null {
  if (!a.enabled) return null;
  const [h, m] = a.time.split(':').map(Number);
  for (let i = 0; i < 8; i++) {
    const d = addDays(now, i);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= now.getTime()) continue;
    if (a.days.length === 0 || a.days.includes(d.getDay())) return d.getTime();
  }
  return null;
}

/** Lo próximo en las siguientes 48 h: alarma, recordatorio o evento con hora. */
export function nextUp(now = new Date()): { title: string; at: number; kind: 'alarm' | 'reminder' | 'event' } | null {
  const s = useStore.getState();
  const cands: { title: string; at: number; kind: 'alarm' | 'reminder' | 'event' }[] = [];
  for (const a of s.alarms) {
    const at = nextAlarm(a, now);
    if (at) cands.push({ title: a.label || t('desk.tray.alarm'), at, kind: 'alarm' });
  }
  for (const r of s.reminders) if (!r.done && r.at > now.getTime()) cands.push({ title: r.title, at: r.at, kind: 'reminder' });
  for (let i = 0; i < 3; i++) {
    const day = addDays(now, i);
    for (const e of eventsOn(s.events, toKey(day))) {
      if (e.allDay) continue;
      const [h, m] = e.start.split(':').map(Number);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
      if (at > now.getTime()) cands.push({ title: e.title, at, kind: 'event' });
    }
  }
  const best = cands.filter((c) => c.at - now.getTime() <= HORIZON).sort((a, b) => a.at - b.at)[0];
  return best ?? null;
}

/** Envía a la bandeja del sistema «Reunión · mañana 10:00». Solo en la ventana principal. */
export function useTrayNextUp(ready: boolean) {
  useEffect(() => {
    if (!desktop?.setTrayInfo || !ready) return;
    let last: string | null | undefined;
    const update = () => {
      const n = nextUp();
      let label: string | null = null;
      if (n) {
        const d = new Date(n.at);
        const day = toKey(d) === toKey(new Date()) ? '' : `${relativeDay(toKey(d))} `;
        label = `${t(`desk.tray.${n.kind}`)}: ${n.title} · ${day}${formatClock(n.at, useStore.getState().settings.use24h)}`;
      }
      if (label !== last) {
        last = label;
        desktop?.setTrayInfo?.(label);
      }
    };
    update();
    const id = setInterval(update, 30_000);
    const unsub = useStore.subscribe(update);
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [ready]);
}
