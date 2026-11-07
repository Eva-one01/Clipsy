import { desktop } from '@/desktop/bridge';

/**
 * Copia texto al portapapeles.
 * Escritorio: lo hace el proceso principal de Electron (siempre permitido).
 * Navegador: API Clipboard y, si no está disponible, el método clásico con un textarea oculto.
 */
export async function copyText(text: string): Promise<boolean> {
  if (desktop?.copyText) {
    desktop.copyText(text);
    return true;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}
