import { categoryLabel } from '@/constants/finance';
import { auxWindow } from '@/desktop/aux';
import { t } from '@/i18n';
import { useStore } from '@/store';
import type { Transaction } from '@/store/types';
import { showDialog } from './dialog';
import { formatMoney } from './money';

const monthOf = (date: string) => date.slice(0, 7);

/** Gasto del mes en una categoría. */
export function spentIn(transactions: Transaction[], month: string, category: string) {
  return transactions.filter((x) => x.type === 'expense' && x.category === category && x.date.startsWith(month)).reduce((s, x) => s + x.amount, 0);
}

/**
 * Tras registrar un gasto, avisa si la categoría llega al 80 % o al 100 % de su límite mensual.
 * Cada aviso se muestra una sola vez por mes y categoría.
 */
export function checkBudgetAlert(category: string, date: string) {
  const { transactions, settings, setSettings } = useStore.getState();
  // La barra de alta rápida se cierra enseguida: el aviso se verá en la ventana principal.
  if (auxWindow === 'quick') return;
  const limit = settings.categoryBudgets?.[category];
  if (!limit || limit <= 0) return;
  const month = monthOf(date);
  const spent = spentIn(transactions, month, category);
  const ratio = spent / limit;
  const level = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : 0;
  if (!level) return;
  const key = `${month}:${category}:${level}`;
  const seen = settings.budgetAlerts ?? [];
  if (seen.includes(key)) return;
  // Se guardan solo los avisos de este mes para no acumular basura.
  setSettings({ budgetAlerts: [...seen.filter((k) => k.startsWith(month)), key] });
  const cat = categoryLabel(category);
  const cur = settings.currency;
  showDialog(
    level === 100 ? t('bud.overTitle', { c: cat }) : t('bud.nearTitle', { c: cat }),
    level === 100
      ? t('bud.overBody', { x: formatMoney(spent - limit, cur), l: formatMoney(limit, cur) })
      : t('bud.nearBody', { p: Math.round(ratio * 100), l: formatMoney(limit, cur), x: formatMoney(Math.max(0, limit - spent), cur) }),
  );
}
