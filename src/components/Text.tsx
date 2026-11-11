import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { type as typeScale, type TypeVariant } from '@/theme/tokens';

type Tone = 'default' | 'muted' | 'faint' | 'accent' | 'success' | 'danger' | 'warning' | 'onAccent';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
  upper?: boolean;
}

export function Text({ variant = 'body', tone = 'default', align, tabular, upper, style, children, ...rest }: AppTextProps) {
  const { c } = useTheme();
  // Ajustes → Estilo: letra más grande para leer de lejos.
  const k = useStore((s) => s.settings.textScale ?? 1);
  const base = typeScale[variant];
  const scaled = k === 1 ? base : { ...base, fontSize: base.fontSize * k, lineHeight: Math.round(base.lineHeight * k) };
  const color = {
    default: c.text,
    muted: c.textMuted,
    faint: c.textFaint,
    accent: c.accent,
    success: c.success,
    danger: c.danger,
    warning: c.warning,
    onAccent: c.onAccent,
  }[tone];

  return (
    <RNText
      maxFontSizeMultiplier={variant === 'numeric' || variant === 'display' ? 1.25 : 1.6}
      {...rest}
      style={[
        scaled,
        { color, textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        upper && { textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
