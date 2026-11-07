import type { TKey } from '@/i18n';
import type { IconName } from './ui';

/** Pestañas principales: las mismas en la barra inferior (móvil) y en la lateral (escritorio). */
export const TABS: Record<string, { label: TKey; icon: IconName }> = {
  index: { label: 'tabs.today', icon: 'sun' },
  calendar: { label: 'tabs.calendar', icon: 'calendar' },
  lists: { label: 'tabs.lists', icon: 'check-square' },
  finance: { label: 'tabs.finance', icon: 'pie-chart' },
  more: { label: 'tabs.more', icon: 'grid' },
};

export interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
}
