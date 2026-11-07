import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ensurePermission, getPermission, type PermissionState } from '@/lib/notifications';
import { useT } from '@/i18n/useT';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { Icon } from './ui';

/** Explica por qué pedimos permiso, justo donde se necesita (no al abrir la app). */
export function PermissionBanner() {
  const { c } = useTheme();
  const { t } = useT();
  const reschedule = useStore((s) => s.rescheduleAll);
  const [state, setState] = useState<PermissionState | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPermission().then(setState).catch(() => setState(null));
    }, []),
  );

  if (state === null || state === 'granted') return null;
  // En escritorio no se puede abrir el ajuste del sistema desde la app: solo se ofrece pedir permiso.
  if (Platform.OS === 'web' && state === 'denied') return null;

  const onPress = async () => {
    if (state === 'denied') {
      Linking.openSettings();
      return;
    }
    const ok = await ensurePermission();
    setState(ok ? 'granted' : 'denied');
    if (ok) await reschedule();
  };

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={{ marginBottom: space.lg }}>
      <PressableScale onPress={onPress} accessibilityLabel={t('perm.title')}>
        <View style={{ flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.warningSoft }}>
          <Icon name="bell-off" size={18} color={c.warning} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">{t('perm.title')}</Text>
            <Text variant="caption" tone="muted">
              {state === 'denied' ? t('perm.denied') : t('perm.ask')}
            </Text>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}
