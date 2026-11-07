import { desktop } from './bridge';

/**
 * Ventanas auxiliares del escritorio: «Hoy» flotante (/mini) y alta rápida (/quick).
 * Comparten los datos con la ventana principal, pero no programan avisos (lo hace solo la principal)
 * ni muestran banners, búsqueda global, etc. Se decide una vez al cargar, por la ruta inicial.
 */
export const auxWindow: 'mini' | 'quick' | null = (() => {
  if (!desktop || typeof window === 'undefined') return null;
  const p = window.location.pathname;
  return p.startsWith('/mini') ? 'mini' : p.startsWith('/quick') ? 'quick' : null;
})();
