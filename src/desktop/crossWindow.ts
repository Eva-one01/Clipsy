import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useStore } from '@/store';
import { auxWindow } from './auxWindow';
import { desktop } from './bridge';

const KEY = 'razor-store';

/**
 * Escritorio: varias ventanas (principal, «Hoy» flotante, alta rápida) usan el mismo almacenamiento.
 * Cuando otra ventana guarda, esta vuelve a leer los datos; la principal además reprograma los avisos.
 */
export function useCrossWindowSync(ready: boolean) {
  useEffect(() => {
    if (!desktop || Platform.OS !== 'web' || !ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== KEY) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        await useStore.persist.rehydrate();
        if (!auxWindow) {
          useStore.getState().postDueRecurring();
          useStore.getState().rescheduleAll().catch(() => undefined);
        }
      }, 250);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      if (timer) clearTimeout(timer);
    };
  }, [ready]);
}
