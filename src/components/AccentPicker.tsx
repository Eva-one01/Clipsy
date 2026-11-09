import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { accentOrder, accents, motion, space, type AccentId } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { Icon } from './ui';

const SIZE = 40;

/** Selector de color de acento: muestra cada opción con el tono del tema actual. */
export function AccentPicker() {
  const { t } = useT();
  const current = useStore((s) => s.settings.accent);
  const setSettings = useStore((s) => s.setSettings);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityRole="radiogroup">
        {accentOrder.map((id) => (
          <Swatch
            key={id}
            id={id}
            selected={id === current}
            label={t(`accent.${id}` as TKey)}
            onPress={() => {
              if (id === current) return;
              setSettings({ accent: id });
            }}
          />
        ))}
      </View>
      <Text variant="caption" tone="muted" align="center">
        {t(`accent.${current}` as TKey)}
      </Text>
    </View>
  );
}

function Swatch({ id, selected, label, onPress }: { id: AccentId; selected: boolean; label: string; onPress: () => void }) {
  const { c, scheme } = useTheme();
  const set = accents[id][scheme];
  const p = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    p.value = withSpring(selected ? 1 : 0, motion.spring);
  }, [selected, p]);

  // Anillo exterior que aparece y núcleo que se encoge un poco al seleccionar.
  const ring = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.85 + p.value * 0.15 }] }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * 0.22 }] }));
  const tick = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.4 + p.value * 0.6 }] }));

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.88}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{ width: SIZE + 8, height: SIZE + 8, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[
          { position: 'absolute', width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, borderWidth: 2, borderColor: set.accent },
          ring,
        ]}
      />
      <Animated.View
        style={[
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: set.accent,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: id === 'graphite' ? 1 : 0,
            borderColor: c.borderStrong,
          },
          core,
        ]}
      >
        <Animated.View style={tick}>
          <Icon name="check" size={18} color={set.onAccent} />
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}
