import Feather from '@expo/vector-icons/Feather';
import { useEffect } from 'react';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

export function Checkbox({ checked, onToggle, color, label, size = 24 }: { checked: boolean; onToggle: () => void; color?: string; label: string; size?: number }) {
  const { c } = useTheme();
  const tint = color ?? c.accent;
  const p = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(checked ? 1 : 0, { duration: motion.base });
  }, [checked, p]);

  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], ['transparent', tint]),
    borderColor: interpolateColor(p.value, [0, 1], [c.borderStrong, tint]),
    transform: [{ scale: 1 + Math.sin(p.value * Math.PI) * 0.14 }],
  }));
  const tick = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.5 + p.value * 0.5 }] }));

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        onToggle();
      }}
      scaleTo={0.88}
    >
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, box]}>
        <Animated.View style={tick}>
          <Feather name="check" size={size * 0.6} color={c.onAccent} />
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}
