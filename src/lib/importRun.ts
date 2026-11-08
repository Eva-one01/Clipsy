import { useStore } from '@/store';
import { tagColors } from '@/theme/tokens';
import type { DateKey } from '@/store/types';
import type { ImportItem } from './importParse';
import { ensurePermission } from './notifications';

const pad = (n: number) => String(n).padStart(2, '0');
function nextOn(day: number): DateKey {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Añade lo elegido en la vista previa. Devuelve cuántos elementos se crearon. */
export async function runImport(items: ImportItem[]): Promise<number> {
  const s = useStore.getState();
  let n = 0;
  let askNotify = false;
  for (const [i, it] of items.entries()) {
    const color = tagColors[i % tagColors.length];
    if (it.type === 'event') {
      const base = {
        title: it.title,
        start: it.start ?? '09:00',
        end: it.end ?? '10:00',
        allDay: !it.start,
        color,
        notes: '',
        interval: 1,
        // Las rutinas se repiten mucho: sin aviso por defecto (se puede activar en cada evento).
        remindBefore: it.repeat === 'none' && it.start ? 15 : null,
      };
      if (it.repeat === 'weekly' && it.days.length) {
        // Un evento semanal por cada día («Gimnasio» lunes, miércoles y viernes).
        for (const day of it.days) await s.addEvent({ ...base, date: nextOn(day), repeat: 'weekly' });
      } else await s.addEvent({ ...base, date: it.date ?? nextOn(new Date().getDay()), repeat: it.repeat });
      if (base.remindBefore !== null) askNotify = true;
    } else if (it.type === 'task') {
      s.addTask({ title: it.title, due: it.date });
    } else if (it.amount) {
      s.addTransaction({ type: it.type, amount: it.amount, category: it.category ?? (it.type === 'income' ? 'other_in' : 'other'), note: it.title, date: it.date ?? nextOn(new Date().getDay()) });
    } else continue;
    n++;
  }
  if (askNotify) ensurePermission().catch(() => undefined);
  return n;
}
