import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { Text } from './Text';
import { Icon, type IconName } from './ui';

/**
 * Lista desplegable: muestra la opción elegida y, al hacer clic, despliega las demás debajo.
 * Se cierra al elegir, con Escape o al hacer clic fuera.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  icon,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** Nombre para lectores de pantalla (p. ej. «Idioma»). */
  label: string;
  icon?: IconName;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  // Clic fuera o Escape: se cierra.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const node = ref.current as unknown as HTMLElement | null;
    const onDown = (e: PointerEvent) => {
      if (node && !node.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: motion.base }) }] }));

  return (
    <Animated.View ref={ref} layout={LinearTransition.duration(motion.base)} style={[styles.box, { backgroundColor: c.surface, borderColor: open ? c.accent : c.border }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.head, { opacity: pressed ? 0.7 : 1 }]}
      >
        {icon ? (
          <View style={[styles.icon, { backgroundColor: c.surfaceAlt }]}>
            <Icon name={icon} size={16} color={c.text} />
          </View>
        ) : null}
        <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
          {current?.label}
        </Text>
        <Animated.View style={chevron}>
          <Icon name="chevron-down" size={18} color={c.textMuted} />
        </Animated.View>
      </Pressable>

      {open ? (
        <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} accessibilityRole="radiogroup" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingVertical: space.xs }}>
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  setOpen(false);
                  if (!sel) onChange(o.value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={o.label}
                style={(st) => [styles.option, { backgroundColor: (st as { hovered?: boolean }).hovered || st.pressed ? c.surfaceAlt : 'transparent' }]}
              >
                <Text variant="body" style={{ flex: 1, fontWeight: sel ? '600' : '400', color: sel ? c.accent : c.text }}>
                  {o.label}
                </Text>
                {sel ? <Icon name="check" size={16} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg },
  icon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: space.lg, marginHorizontal: space.xs, borderRadius: radius.sm },
});
