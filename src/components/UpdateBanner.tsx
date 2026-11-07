import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { desktop } from '@/desktop/bridge';
import { useDesktopState } from '@/desktop/licensing';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { Text } from './Text';
import { Button, Icon, IconButton } from './ui';

/** Aviso flotante (abajo a la derecha) cuando hay una versión nueva lista o disponible. */
export function UpdateBanner() {
  const { c } = useTheme();
  const { t } = useT();
  const update = useDesktopState((s) => s.update);
  const [hidden, setHidden] = useState<string | null>(null);

  const ready = update?.status === 'ready';
  const manual = update?.status === 'available' && update.manual;
  if (!desktop?.updates || !update?.version || (!ready && !manual) || hidden === update.version) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.slow).springify().damping(20)}
      exiting={FadeOutDown.duration(motion.base)}
      style={[styles.box, { backgroundColor: c.elevated, borderColor: c.borderStrong }]}
      accessibilityRole="alert"
    >
      <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
        <Icon name="download-cloud" size={18} color={c.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{t('upd.title', { v: update.version })}</Text>
        <Text variant="caption" tone="muted">
          {ready ? t('upd.readyBody') : t('upd.manualBody')}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: space.sm }}>
          <Button title={ready ? t('upd.restart') : t('upd.download')} onPress={() => desktop?.updates?.install()} />
        </View>
      </View>
      <IconButton icon="x" label={t('upd.later')} size={30} onPress={() => setHidden(update.version ?? null)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    zIndex: 400,
    width: 360,
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
