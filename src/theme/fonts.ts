import { Platform } from 'react-native';

/**
 * Letra de la app: Nunito (SIL OFL 1.1, public/fonts/Nunito-OFL.txt). Redondeada y amable, con pesos
 * gruesos que se leen bien de lejos, y con cirílico para el ruso. Va dentro de la app (sin internet).
 */
export const FONT = "Nunito, 'Segoe UI', system-ui, -apple-system, sans-serif";

const FACES: [string, string][] = [
  ['nunito-cyrillic-wght-normal.woff2', 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'],
  [
    'nunito-latin-ext-wght-normal.woff2',
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  ],
  ['nunito-latin-wght-normal.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
];

/** Carga la letra y la aplica también a los campos de texto (los <Text> la toman de tokens.ts). */
export function installFonts() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || document.getElementById('razor-fonts')) return;
  const css =
    FACES.map(
      ([file, range]) =>
        `@font-face{font-family:'Nunito';font-style:normal;font-weight:200 1000;font-display:swap;src:url('/fonts/${file}') format('woff2');unicode-range:${range};}`,
    ).join('') + `input,textarea,select,button{font-family:${FONT} !important;font-weight:600;}`;
  const el = document.createElement('style');
  el.id = 'razor-fonts';
  el.textContent = css;
  document.head.appendChild(el);
}
