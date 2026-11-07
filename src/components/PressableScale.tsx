import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { motion } from '@/theme/tokens';

const APressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticOnPress?: boolean;
}

/** Botón base: compresión sutil con muelle + leve atenuación. */
export function PressableScale({
  style,
  scaleTo = 0.97,
  hapticOnPress = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }],
    opacity: disabled ? 0.4 : 1 - pressed.value * 0.12,
  }));

  return (
    <APressable
      accessibilityRole="button"
      hitSlop={6}
      disabled={disabled}
      {...rest}
      onPressIn={(e) => {
        pressed.value = withTiming(1, { duration: motion.fast });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, motion.spring);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic.tap();
        onPress?.(e);
      }}
      style={[style, aStyle]}
    >
      {children}
    </APressable>
  );
}
