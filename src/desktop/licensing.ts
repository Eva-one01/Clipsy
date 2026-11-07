import type { TKey } from '@/i18n';
import { useEffect } from 'react';
import { create } from 'zustand';
import { desktop, type LicenseState, type UpdateState } from './bridge';

/** Estado de licencia y actualizaciones que llega del proceso principal de Electron. */
export const useDesktopState = create<{ license: LicenseState | null; update: UpdateState | null }>()(() => ({
  license: null,
  update: null,
}));

/** Conecta el estado del escritorio una sola vez (en el layout raíz). Fuera del escritorio no hace nada. */
export function useDesktopStateSync() {
  useEffect(() => {
    const lic = desktop?.license;
    const upd = desktop?.updates;
    if (!lic || !upd) return;
    lic.get().then((license) => useDesktopState.setState({ license })).catch(() => undefined);
    upd.get().then((update) => useDesktopState.setState({ update })).catch(() => undefined);
    const off1 = lic.onChange((license) => useDesktopState.setState({ license }));
    const off2 = upd.onChange((update) => useDesktopState.setState({ update }));
    return () => {
      off1();
      off2();
    };
  }, []);
}

/**
 * Qué mostrar según la licencia: 'open' (la app), 'loading' (aún no se sabe) o 'gate' (pantalla de activación).
 * Solo aplica en la app de escritorio; en la web y en el móvil siempre es 'open'.
 */
export function useLicenseGate(): 'open' | 'loading' | 'gate' {
  const license = useDesktopState((s) => s.license);
  if (!desktop?.license) return 'open';
  if (!license || license.status === 'checking') return 'loading';
  return license.status === 'valid' ? 'open' : 'gate';
}

/** La app de escritorio con licencias se conecta para validar: algunos textos de privacidad cambian. */
const DESK_KEYS = new Set(['onb.2.body', 'set.footer', 'legal.summary', 'legal.p1.b', 'legal.p3.b', 'legal.p5.b', 'help.a1']);
export function dk(key: TKey): TKey {
  return desktop?.license && DESK_KEYS.has(key) ? ((key + 'Desk') as TKey) : key;
}
