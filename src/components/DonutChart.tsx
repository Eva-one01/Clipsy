import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

const ACircle = Animated.createAnimatedComponent(Circle);

export interface DonutSlice {
  key: string;
  /** Fracción del total (0–1). */
  value: number;
  color: string;
}

interface Props {
  slices: DonutSlice[];
  size?: number;
  stroke?: number;
  /** Clave resaltada: el resto se atenúa. */
  selected?: string | null;
  /** Cambiar esta clave vuelve a reproducir el barrido (p. ej. al cambiar de mes). */
  animationKey?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
}

/** Separación entre porciones, en px de arco (deja ver la superficie entre colores). */
const GAP = 2;

/**
 * Gráfica de torta (anillo). La pista de fondo representa el 100 % de la base;
 * las porciones de color cubren la parte gastada en cada categoría.
 * Un único valor animado barre todo el anillo, así las porciones aparecen en orden.
 */
export function DonutChart({ slices, size = 200, stroke = 26, selected, animationKey, accessibilityLabel, children }: Props) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = 0;
    p.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [animationKey, p]);

  let start = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = Math.min(1, s.value) * circ;
      const arc = { ...s, start, len };
      start += len;
      return arc;
    });
  const gap = arcs.length > 1 ? GAP : 0;

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceAlt} strokeWidth={stroke} fill="none" />
        {arcs.map((a) => (
          <G key={a.key} rotation={-90 + (a.start / circ) * 360} origin={`${size / 2}, ${size / 2}`}>
            <Arc
              progress={p}
              circ={circ}
              start={a.start}
              len={Math.max(0.5, a.len - gap)}
              cx={size / 2}
              r={r}
              stroke={stroke}
              color={a.color}
              dim={!!selected && selected !== a.key}
            />
          </G>
        ))}
      </Svg>
      {children}
    </View>
  );
}

function Arc({
  progress,
  circ,
  start,
  len,
  cx,
  r,
  stroke,
  color,
  dim,
}: {
  progress: SharedValue<number>;
  circ: number;
  start: number;
  len: number;
  cx: number;
  r: number;
  stroke: number;
  color: string;
  dim: boolean;
}) {
  const props = useAnimatedProps(() => {
    const visible = Math.max(0, Math.min(len, progress.value * circ - start));
    return { strokeDashoffset: len - visible };
  });
  return (
    <ACircle
      cx={cx}
      cy={cx}
      r={r}
      stroke={color}
      strokeOpacity={dim ? 0.25 : 1}
      strokeWidth={stroke}
      fill="none"
      strokeDasharray={`${len} ${circ}`}
      animatedProps={props}
    />
  );
}
