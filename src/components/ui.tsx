import Feather from '@expo/vector-icons/Feather';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: ComponentProps<typeof Feather>['style'] }) {
  const { c } = useTheme();
  return <Feather name={name} size={size} color={color ?? c.text} style={style} />;
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
        padded && { padding: space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  variant = 'ghost',
  size = 40,
  color,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  variant?: 'ghost' | 'filled' | 'accent';
  size?: number;
  color?: string;
}) {
  const { c } = useTheme();
  const bg = variant === 'accent' ? c.accent : variant === 'filled' ? c.surfaceAlt : 'transparent';
  const fg = color ?? (variant === 'accent' ? c.onAccent : c.text);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      scaleTo={0.9}
      style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={fg} />
    </PressableScale>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  full,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  full?: boolean;
}) {
  const { c } = useTheme();
  const styles = {
    primary: { bg: c.accent, fg: c.onAccent, border: 'transparent' },
    secondary: { bg: c.surfaceAlt, fg: c.text, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.danger, border: 'transparent' },
    ghost: { bg: 'transparent', fg: c.text, border: c.borderStrong },
  }[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={title}
      style={{
        height: 50,
        paddingHorizontal: space.xl,
        borderRadius: radius.md,
        backgroundColor: styles.bg,
        borderWidth: variant === 'ghost' ? 1 : 0,
        borderColor: styles.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        alignSelf: full ? 'stretch' : 'auto',
      }}
    >
      {icon && <Icon name={icon} size={18} color={styles.fg} />}
      <Text variant="bodyStrong" style={{ color: styles.fg }}>
        {title}
      </Text>
    </PressableScale>
  );
}

export function Chip({ label, selected, onPress, color, icon }: { label: string; selected?: boolean; onPress?: () => void; color?: string; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: space.md,
        height: 34,
        borderRadius: radius.pill,
        backgroundColor: selected ? c.text : c.surfaceAlt,
      }}
    >
      {color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      {icon && <Icon name={icon} size={14} color={selected ? c.bg : c.textMuted} />}
      <Text variant="caption" style={{ color: selected ? c.bg : c.textMuted }}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm, marginTop: space.xl }}>
      <Text variant="label" tone="faint" upper accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <PressableScale onPress={onAction} accessibilityLabel={action}>
          <Text variant="caption" tone="accent">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: inset }} />;
}

export function EmptyState({ icon, title, subtitle, action, onAction }: { icon: IconName; title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(motion.slow)} style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.sm }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs }}>
        <Icon name={icon} size={22} color={c.textMuted} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" tone="muted" align="center" style={{ maxWidth: 280 }}>
          {subtitle}
        </Text>
      ) : null}
      {action && onAction ? (
        <View style={{ marginTop: space.md }}>
          <Button title={action} onPress={onAction} variant="secondary" icon="plus" />
        </View>
      ) : null}
    </Animated.View>
  );
}

export function ProgressBar({ value, color, height = 6, track }: { value: number; color?: string; height?: number; track?: string }) {
  const { c } = useTheme();
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withSpring(Math.max(0, Math.min(1, value)), motion.springSoft);
  }, [value, w]);
  const aStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height, borderRadius: height, backgroundColor: track ?? c.surfaceAlt, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color ?? c.accent }, aStyle]} />
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  chevron = true,
  danger,
  right,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  right?: ReactNode;
}) {
  const { c } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: space.lg, gap: space.md }}>
      {icon && (
        <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: danger ? c.dangerSoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={danger ? c.danger : c.text} />
        </View>
      )}
      <View style={{ flex: 1, paddingVertical: space.md }}>
        <Text variant="body" tone={danger ? 'danger' : 'default'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" tone="muted">
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && chevron && !right ? <Icon name="chevron-right" size={18} color={c.textFaint} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityLabel={title}>
      {content}
    </PressableScale>
  );
}

/**
 * Interruptor propio (no el Switch del sistema): en escritorio react-native-web ignora
 * thumbColor y pintaba el círculo de verde azulado fijo. Así track y círculo siguen el acento.
 */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  const p = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    p.value = withSpring(value ? 1 : 0, motion.spring);
  }, [value, p]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [c.surfaceAlt, c.accent]),
    borderColor: interpolateColor(p.value, [0, 1], [c.borderStrong, c.accent]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * (TOGGLE_W - TOGGLE_THUMB - 6) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        onChange(!value);
      }}
    >
      <Animated.View style={[styles.toggleTrack, track]}>
        <Animated.View style={[styles.toggleThumb, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

const TOGGLE_W = 46;
const TOGGLE_THUMB = 22;

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

const styles = StyleSheet.create({
  toggleTrack: {
    width: TOGGLE_W,
    height: TOGGLE_THUMB + 6,
    borderRadius: (TOGGLE_THUMB + 6) / 2,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: TOGGLE_THUMB,
    height: TOGGLE_THUMB,
    borderRadius: TOGGLE_THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
