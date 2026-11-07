import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from '@/store';
import { accents, palettes, type ColorScheme, type Palette } from './tokens';

interface ThemeValue {
  scheme: ColorScheme;
  isDark: boolean;
  c: Palette;
}

const ThemeContext = createContext<ThemeValue>({ scheme: 'dark', isDark: true, c: palettes.dark });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useStore((s) => s.settings.theme);
  const accentId = useStore((s) => s.settings.accent);
  const scheme: ColorScheme = pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref;

  const value = useMemo<ThemeValue>(() => {
    const accent = (accents[accentId] ?? accents.blue)[scheme];
    return { scheme, isDark: scheme === 'dark', c: { ...palettes[scheme], ...accent } };
  }, [scheme, accentId]);

  useEffect(() => {
    // Fondo de la ventana nativa: evita destellos blancos/negros entre pantallas.
    SystemUI.setBackgroundColorAsync(value.c.bg).catch(() => undefined);
  }, [value.c.bg]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
