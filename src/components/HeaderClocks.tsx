import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { clockLabel } from '@/constants/cities';
import { useIsDesktop } from '@/desktop/layout';
import { useT } from '@/i18n/useT';
import { formatTime } from '@/lib/date';
import { zoned } from '@/lib/timezone';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store';
import type { WorldClock } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** Altura que ocupa la franja de relojes; Screen la reserva encima del título. */
export const HEADER_CLOCKS_HEIGHT = 36;

/** Reloj principal + relojes fijados por el usuario (máx. 1 en móvil, 3 en escritorio). */
export function useHeaderClocks(): { primary: WorldClock | null; secondary: WorldClock[] } {
  const clocks = useStore((s) => s.clocks);
  const primaryId = useStore((s) => s.settings.primaryClockId);
  const isDesktop = useIsDesktop();
  return useMemo(() => {
    const primary = clocks.find((c) => c.id === primaryId) ?? clocks[0] ?? null;
    const secondary = clocks.filter((c) => c.pinned && c.id !== primary?.id).slice(0, isDesktop ? 3 : 1);
    return { primary, secondary };
  }, [clocks, primaryId, isDesktop]);
}

function hm(tz: string, now: Date) {
  const z = zoned(tz, now);
  return `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
}

/** Relojes siempre visibles en la esquina superior derecha. Tocar abre la pantalla de relojes. */
export function HeaderClocks() {
  const { c } = useTheme();
  const { lang } = useT();
  const now = useNow();
  const use24h = useStore((s) => s.settings.use24h);
  const { primary, secondary } = useHeaderClocks();

  if (!primary) return null;

  const label = [primary, ...secondary].map((cl) => `${clockLabel(cl, lang)} ${formatTime(hm(cl.tz, now), use24h)}`).join(', ');

  return (
    <PressableScale onPress={() => router.push('/clocks')} accessibilityLabel={label} scaleTo={0.96}>
      <Animated.View
        layout={LinearTransition.duration(motion.base)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: HEADER_CLOCKS_HEIGHT - 4,
          paddingHorizontal: space.md,
          gap: space.md,
          borderRadius: radius.pill,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        {secondary.map((cl) => (
          <Animated.View key={cl.id} entering={FadeIn.duration(motion.base)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
            <Text variant="caption" tone="faint" numberOfLines={1} style={{ maxWidth: 90 }}>
              {clockLabel(cl, lang)}
            </Text>
            <Text variant="caption" tone="muted" tabular>
              {formatTime(hm(cl.tz, now), use24h)}
            </Text>
          </Animated.View>
        ))}
        {secondary.length > 0 && <View style={{ width: 1, height: 14, backgroundColor: c.border }} />}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: 110 }}>
            {clockLabel(primary, lang)}
          </Text>
          <Text variant="bodyStrong" tabular>
            {formatTime(hm(primary.tz, now), use24h)}
          </Text>
        </View>
      </Animated.View>
    </PressableScale>
  );
}
