import { t } from '@/i18n';
import { useStore } from '@/store';
import { tagColors } from '@/theme/tokens';
import { checkBudgetAlert } from './budget';
import { fromKey, relativeDay } from './date';
import { formatMoney } from './money';
import { ensurePermission } from './notifications';
import type { QuickKind, QuickParsed } from './quickParse';

export const KIND_ICON: Record<QuickKind, 'check-square' | 'calendar' | 'bell' | 'minus-circle' | 'plus-circle' | 'zap'> = {
  task: 'check-square',
  event: 'calendar',
  reminder: 'bell',
  expense: 'minus-circle',
  income: 'plus-circle',
  idea: 'zap',
};

/** «Mañana · 10:00–11:00 · prioridad alta» para la vista previa. */
export function describeQuick(p: QuickParsed, currency: string): string {
  const bits: string[] = [];
  if (p.amount !== null) bits.push(formatMoney(p.amount, currency));
  if (p.date) bits.push(relativeDay(p.date));
  if (p.time) bits.push(p.end && p.kind === 'event' ? `${p.time}–${p.end}` : p.time);
  if (p.kind === 'task' && p.priority === 2) bits.push(t('qa.prioHigh'));
  else if (p.kind === 'task' && p.priority === 1) bits.push(t('qa.prioMed'));
  return bits.join(' · ');
}

/** Crea lo que dice el texto. Devuelve false si falta algo (p. ej. título vacío). */
export async function runQuick(p: QuickParsed): Promise<boolean> {
  const s = useStore.getState();
  const title = p.title.trim();
  switch (p.kind) {
    case 'task':
      if (!title) return false;
      s.addTask({ title, due: p.date, priority: p.priority });
      return true;
    case 'idea':
      if (!title) return false;
      s.addIdea(title);
      return true;
    case 'event':
      if (!title || !p.date) return false;
      await s.addEvent({
        title,
        date: p.date,
        start: p.time ?? '09:00',
        end: p.end ?? '10:00',
        allDay: !p.time,
        color: tagColors[0],
        notes: '',
        repeat: 'none',
        remindBefore: p.time ? 15 : null,
      });
      if (p.time) ensurePermission().catch(() => undefined);
      return true;
    case 'reminder': {
      if (!title || !p.date || !p.time) return false;
      const d = fromKey(p.date);
      const [h, m] = p.time.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      await ensurePermission().catch(() => undefined);
      await s.addReminder({ title, at: d.getTime() });
      return true;
    }
    case 'expense':
    case 'income': {
      if (!p.amount || !p.date) return false;
      const category = p.kind === 'income' ? 'other_in' : 'other';
      s.addTransaction({ type: p.kind, amount: p.amount, category, note: title, date: p.date });
      if (p.kind === 'expense') checkBudgetAlert(category, p.date);
      return true;
    }
  }
}
