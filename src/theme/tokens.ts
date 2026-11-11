import { FONT } from './fonts';
/**
 * Clipsy design tokens.
 * Concepto: precisión. Superficies neutras, líneas finas, un solo acento,
 * números tabulares y radios contenidos (afilado, no redondeado de juguete).
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  overlay: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    bg: '#F6F6F4',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEEEB',
    elevated: '#FFFFFF',
    text: '#0E0E10',
    textMuted: '#5F5F66',
    textFaint: '#9C9CA3',
    border: 'rgba(14,14,16,0.08)',
    borderStrong: 'rgba(14,14,16,0.16)',
    accent: '#2E55E6',
    accentSoft: 'rgba(46,85,230,0.10)',
    onAccent: '#FFFFFF',
    success: '#16875A',
    successSoft: 'rgba(22,135,90,0.10)',
    danger: '#CC3D3D',
    dangerSoft: 'rgba(204,61,61,0.10)',
    warning: '#B57A0C',
    warningSoft: 'rgba(181,122,12,0.12)',
    overlay: 'rgba(10,10,11,0.35)',
  },
  dark: {
    bg: '#0A0A0B',
    surface: '#141416',
    surfaceAlt: '#1C1C1F',
    elevated: '#1A1A1D',
    text: '#F2F2F0',
    textMuted: '#A0A0A7',
    textFaint: '#5E5E65',
    border: 'rgba(255,255,255,0.07)',
    borderStrong: 'rgba(255,255,255,0.14)',
    accent: '#7B93FF',
    accentSoft: 'rgba(123,147,255,0.14)',
    onAccent: '#0A0A0B',
    success: '#3CCB8A',
    successSoft: 'rgba(60,203,138,0.14)',
    danger: '#FF6B6B',
    dangerSoft: 'rgba(255,107,107,0.14)',
    warning: '#F2B544',
    warningSoft: 'rgba(242,181,68,0.14)',
    overlay: 'rgba(0,0,0,0.55)',
  },
};

/**
 * Colores de acento elegibles. Cada uno tiene versión clara y oscura con contraste AA
 * (texto de acento sobre fondo y texto sobre botón ≥ 4.5:1). Se evitan verde, rojo y ámbar
 * para no confundirse con los colores de estado (ingreso, error, aviso).
 */
export type AccentId = 'blue' | 'violet' | 'teal' | 'magenta' | 'graphite';
export type AccentSet = Pick<Palette, 'accent' | 'accentSoft' | 'onAccent'>;

export const accentOrder: AccentId[] = ['blue', 'violet', 'teal', 'magenta', 'graphite'];

export const accents: Record<AccentId, Record<ColorScheme, AccentSet>> = {
  blue: {
    light: { accent: '#2E55E6', accentSoft: 'rgba(46,85,230,0.10)', onAccent: '#FFFFFF' },
    dark: { accent: '#7B93FF', accentSoft: 'rgba(123,147,255,0.14)', onAccent: '#0A0A0B' },
  },
  violet: {
    light: { accent: '#7240D6', accentSoft: 'rgba(114,64,214,0.10)', onAccent: '#FFFFFF' },
    dark: { accent: '#B394FF', accentSoft: 'rgba(179,148,255,0.14)', onAccent: '#0A0A0B' },
  },
  teal: {
    light: { accent: '#0B7480', accentSoft: 'rgba(11,116,128,0.10)', onAccent: '#FFFFFF' },
    dark: { accent: '#4CCFD8', accentSoft: 'rgba(76,207,216,0.14)', onAccent: '#0A0A0B' },
  },
  magenta: {
    light: { accent: '#B5276F', accentSoft: 'rgba(181,39,111,0.10)', onAccent: '#FFFFFF' },
    dark: { accent: '#F283BF', accentSoft: 'rgba(242,131,191,0.14)', onAccent: '#0A0A0B' },
  },
  graphite: {
    light: { accent: '#2A2A2E', accentSoft: 'rgba(42,42,46,0.08)', onAccent: '#FFFFFF' },
    dark: { accent: '#E4E4E1', accentSoft: 'rgba(228,228,225,0.12)', onAccent: '#0A0A0B' },
  },
};

/** Colores para eventos/etiquetas. Apagados para que convivan con el acento. */
/**
 * Colores de gráficas por categoría (validados para daltonismo y contraste en claro y oscuro).
 * El color sigue a la categoría, nunca a su posición: "Comida" es siempre azul.
 * El rojo se reserva para estados de alerta, por eso no aparece aquí.
 */
export const chartColors: Record<ColorScheme, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'],
};

export const tagColors = ['#7B93FF', '#3CCB8A', '#F2B544', '#FF6B6B', '#B58CFF', '#4FC3D9', '#A0A0A7'] as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

// Letra grande, gruesa y amable (Nunito): se lee de un vistazo y también a distancia.
const F = { fontFamily: FONT };
export const type = {
  display: { ...F, fontSize: 38, lineHeight: 46, fontWeight: '900' as const, letterSpacing: -0.6 },
  title: { ...F, fontSize: 27, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.3 },
  heading: { ...F, fontSize: 19, lineHeight: 25, fontWeight: '800' as const, letterSpacing: -0.1 },
  body: { ...F, fontSize: 17, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0 },
  bodyStrong: { ...F, fontSize: 17, lineHeight: 24, fontWeight: '800' as const, letterSpacing: 0 },
  caption: { ...F, fontSize: 14.5, lineHeight: 19, fontWeight: '600' as const, letterSpacing: 0 },
  label: { ...F, fontSize: 12.5, lineHeight: 16, fontWeight: '800' as const, letterSpacing: 0.8 },
  numeric: { ...F, fontSize: 44, lineHeight: 50, fontWeight: '500' as const, letterSpacing: -1 },
} as const;

export type TypeVariant = keyof typeof type;

/** Curvas y duraciones: todo comparte el mismo "pulso". */
export const motion = {
  fast: 160,
  base: 240,
  slow: 380,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 160, mass: 1 },
} as const;
