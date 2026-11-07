import { Platform, useWindowDimensions } from 'react-native';

/** Ancho de la barra lateral de navegación en escritorio. */
export const SIDEBAR_WIDTH = 232;
/** Ancho máximo del contenido: líneas cómodas de leer en monitores grandes. */
export const CONTENT_MAX_WIDTH = 760;
/** A partir de este ancho de ventana se usa el diseño de escritorio. */
const DESKTOP_BREAKPOINT = 860;

/** true en escritorio/web con ventana ancha: barra lateral, contenido centrado y formularios flotantes. */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}
