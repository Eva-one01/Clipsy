import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { openPalette } from '@/lib/palette';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { auxWindow } from './aux';
import { desktop, type MenuAction } from './bridge';
import { useTrayNextUp } from './nextUp';

const STYLE_ID = 'razor-desktop-css';

/** Ajustes de "app de escritorio" sobre react-native-web: scrollbars discretas, sin selección accidental, etc. */
function injectCss(thumb: string) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
    html, body, #root { height: 100%; overflow: hidden; }
    body { -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none; }
    input, textarea, [contenteditable="true"] { user-select: text; -webkit-user-select: text; }
    * { scrollbar-width: thin; scrollbar-color: ${thumb} transparent; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: ${thumb}; border-radius: 8px; border: 3px solid transparent; background-clip: content-box; }
    ::-webkit-scrollbar-track { background: transparent; }
    :focus-visible { outline: 2px solid var(--razor-accent); outline-offset: 2px; border-radius: 6px; }
    textarea:focus-visible, input:focus-visible { outline: none; }
  `;
}

const routes: Record<MenuAction, () => void> = {
  'nav:index': () => router.navigate('/'),
  'nav:calendar': () => router.navigate('/calendar'),
  'nav:lists': () => router.navigate('/lists'),
  'nav:finance': () => router.navigate('/finance'),
  'nav:more': () => router.navigate('/more'),
  'new:task': () => router.push('/form/task'),
  'new:event': () => router.push('/form/event'),
  'new:reminder': () => router.push('/form/reminder'),
  'new:transaction': () => router.push('/form/transaction'),
  'open:settings': () => router.push('/settings'),
  'open:help': () => router.push('/help'),
  'open:search': () => openPalette(),
};

/**
 * Integración con la app de escritorio (Electron). En móvil no hace nada.
 * - Estilos globales de escritorio.
 * - Envía idioma y tema al proceso principal (menús, bandeja y barra de título del sistema).
 * - Atajos de teclado y menú → navegación.
 * - Reprograma las notificaciones al arrancar (en escritorio viven en memoria).
 */
export function useDesktopIntegration(ready: boolean) {
  const { c, isDark } = useTheme();
  const language = useStore((s) => s.settings.language);
  const theme = useStore((s) => s.settings.theme);
  const onboarded = useStore((s) => s.settings.onboarded);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    injectCss(isDark ? 'rgba(255,255,255,0.16)' : 'rgba(14,14,16,0.18)');
    document.documentElement.style.setProperty('--razor-accent', c.accent);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark, c.accent]);

  useEffect(() => {
    desktop?.setLanguage(language);
    if (Platform.OS === 'web') document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    desktop?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!desktop || !ready || !onboarded || auxWindow) return;
    const off1 = desktop.onMenu((action) => routes[action]?.());
    // Las ventanas auxiliares piden abrir algo aquí («Abrir Clipsy», un evento…).
    const off2 = desktop.onNavigate?.((route) => router.push(route as never));
    return () => {
      off1();
      off2?.();
    };
  }, [ready, onboarded]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !ready || auxWindow) return;
    useStore.getState().rescheduleAll().catch(() => undefined);
  }, [ready]);

  useTrayNextUp(ready && onboarded && !auxWindow);
}
