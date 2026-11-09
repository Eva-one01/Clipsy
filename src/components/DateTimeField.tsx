import { useState } from 'react';
import { dateToTime, toKey } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, type as typeScale } from '@/theme/tokens';

interface Props {
  mode: 'date' | 'time';
  value: Date;
  onChange: (d: Date) => void;
  label: string;
  use24h?: boolean;
  minimumDate?: Date;
  /** Versión grande (hora de la alarma). */
  large?: boolean;
}

/**
 * Escritorio/web: campos nativos del navegador (<input type="date|time">), que en Electron
 * abren el selector del sistema y se pueden escribir con el teclado.
 */
export function DateTimeField({ mode, value, onChange, label, minimumDate, large }: Props) {
  const { c, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const str = mode === 'date' ? toKey(value) : dateToTime(value);

  const handle = (raw: string) => {
    if (!raw) return;
    const d = new Date(value);
    if (mode === 'date') {
      const [y, m, day] = raw.split('-').map(Number);
      d.setFullYear(y, m - 1, day);
    } else {
      const [h, min] = raw.split(':').map(Number);
      d.setHours(h, min, 0, 0);
    }
    onChange(d);
  };

  const t = large ? typeScale.numeric : typeScale.body;

  return (
    <input
      type={mode}
      aria-label={label}
      value={str}
      min={mode === 'date' && minimumDate ? toKey(minimumDate) : undefined}
      onChange={(e) => handle(e.currentTarget.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        colorScheme: isDark ? 'dark' : 'light',
        fontFamily: 'inherit',
        fontSize: large ? 64 : t.fontSize,
        fontWeight: large ? 300 : 500,
        letterSpacing: large ? -2 : 0,
        fontVariantNumeric: 'tabular-nums',
        color: c.text,
        background: large ? 'transparent' : c.surfaceAlt,
        border: `1px solid ${focused ? c.accent : 'transparent'}`,
        borderRadius: radius.sm,
        padding: large ? `${space.xs}px ${space.md}px` : `${space.xs + 2}px ${space.md}px`,
        outline: 'none',
        cursor: 'pointer',
        textAlign: 'center',
        accentColor: c.accent,
      }}
    />
  );
}
