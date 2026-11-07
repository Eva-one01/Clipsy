import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Monograma de Clipsy: una C abierta (el ciclo del tiempo) con una gota que cae por la abertura,
 * como en una clepsidra (reloj de agua). Dentro de la app la gota usa el color de acento elegido.
 * Mismas formas que assets/images/icon.png (lienzo 1024, recortado al glifo).
 */
const VIEWBOX = '276 276 466 472';
const RATIO = 466 / 472;
const ARC = 'M 660.6 378.2 A 200 200 0 1 0 660.6 645.8';
const DROP = 'M 696.0 466.8 C 710.8 495.2 737.0 534.1 737.0 554.2 A 41.0 41.0 0 0 1 655.0 554.2 C 655.0 534.1 681.2 495.2 696.0 466.8 Z';

export function Logo({ height = 40, color, accent }: { height?: number; color?: string; accent?: string }) {
  const { c } = useTheme();
  return (
    <Svg width={height * RATIO} height={height} viewBox={VIEWBOX} accessibilityRole="image" accessibilityLabel="Clipsy">
      <Path d={ARC} fill="none" stroke={color ?? c.text} strokeWidth={64} />
      <Path d={DROP} fill={accent ?? c.accent} />
    </Svg>
  );
}
