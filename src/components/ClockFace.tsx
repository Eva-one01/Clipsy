import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { splitTime } from '@/lib/date';
import type { ClockStyle } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export const CLOCK_STYLES: ClockStyle[] = ['digital', 'analog', 'minimal', 'bold'];
export const nextClockStyle = (s: ClockStyle): ClockStyle => CLOCK_STYLES[(CLOCK_STYLES.indexOf(s) + 1) % CLOCK_STYLES.length];

/** Esfera con agujas (horas, minutos y segundos). */
export function AnalogClock({ h, m, s, size = 64, night }: { h: number; m: number; s: number; size?: number; night?: boolean }) {
  const { c } = useTheme();
  const r = size / 2;
  const hand = (deg: number, len: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x2: r + Math.cos(a) * len, y2: r + Math.sin(a) * len };
  };
  const hourDeg = ((h % 12) + m / 60) * 30;
  const minDeg = (m + s / 60) * 6;
  const secDeg = s * 6;
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={r - 1.5} fill={night ? c.surfaceAlt : c.surface} stroke={c.borderStrong} strokeWidth={1.5} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const inner = i % 3 === 0 ? r - 9 : r - 6;
        return (
          <Line
            key={i}
            x1={r + Math.sin(a) * inner}
            y1={r - Math.cos(a) * inner}
            x2={r + Math.sin(a) * (r - 3.5)}
            y2={r - Math.cos(a) * (r - 3.5)}
            stroke={i % 3 === 0 ? c.text : c.textFaint}
            strokeWidth={i % 3 === 0 ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}
      <Line x1={r} y1={r} {...hand(hourDeg, r * 0.5)} stroke={c.text} strokeWidth={3.2} strokeLinecap="round" />
      <Line x1={r} y1={r} {...hand(minDeg, r * 0.74)} stroke={c.text} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={r} y1={r} {...hand(secDeg, r * 0.8)} stroke={c.accent} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={r} cy={r} r={2.6} fill={c.accent} />
    </Svg>
  );
}

/** La hora de un reloj en el estilo elegido (Relojes). */
export function ClockFace({ style, h, m, s, use24h, night }: { style: ClockStyle; h: number; m: number; s: number; use24h: boolean; night?: boolean }) {
  const { c } = useTheme();
  const hm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const [main, suffix] = splitTime(hm, use24h);
  if (style === 'analog') return <AnalogClock h={h} m={m} s={s} size={72} night={night} />;
  if (style === 'minimal') {
    return (
      <Text variant="numeric" tabular style={{ fontSize: 40, lineHeight: 46, fontWeight: '200', letterSpacing: 1, color: c.textMuted }}>
        {main}
        {suffix ? <Text variant="caption" tone="faint">{` ${suffix}`}</Text> : null}
      </Text>
    );
  }
  if (style === 'bold') {
    return (
      <View style={{ backgroundColor: c.accentSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text variant="numeric" tabular style={{ fontSize: 38, lineHeight: 46, fontWeight: '900', color: c.accent }}>
          {main}
          {suffix ? <Text variant="caption" style={{ color: c.accent }}>{` ${suffix}`}</Text> : null}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text variant="numeric" tabular style={{ fontSize: 36, lineHeight: 42 }}>
        {main}
        {suffix ? <Text variant="caption" tone="muted">{` ${suffix}`}</Text> : null}
      </Text>
      <Text variant="caption" tone="faint" tabular>
        :{String(s).padStart(2, '0')}
      </Text>
    </View>
  );
}
