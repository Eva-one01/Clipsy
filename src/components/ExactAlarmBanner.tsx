import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useT } from '@/i18n/useT';
import { canScheduleExactAlarms, openExactAlarmSettings } from '@/lib/exactAlarms';
import { getPermission } from '@/lib/notifications';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { Icon } from './ui';

/**
 * Android 12+: avisa si falta el permiso de alarmas exactas y lleva al ajuste del sistema.
 * Se vuelve a comprobar al regresar a la app. La reprogramación al conceder el permiso
 * la hace useExactAlarmWatcher en el layout raíz.
 */
export function ExactAlarmBanner() {
  const { c } = useTheme();
  const { t } = useT();
  const [visible, setVisible] = useState(false);

  const check = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const notif = await getPermission().catch(() => 'undetermined' as const);
    // Solo tiene sentido si las notificaciones ya están permitidas (si no, manda el otro aviso).
    setVisible(notif === 'granted' && !canScheduleExactAlarms());
  }, []);

  useFocusEffect(
    useCallback(() => {
      check();
    }, [check]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={{ marginBottom: space.lg }}>
      <PressableScale
        onPress={() => {
          if (!openExactAlarmSettings()) Linking.openSettings();
        }}
        accessibilityLabel={t('exact.title')}
      >
        <View style={{ flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.warningSoft }}>
          <Icon name="clock" size={18} color={c.warning} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">{t('exact.title')}</Text>
            <Text variant="caption" tone="muted">
              {t('exact.body')}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={c.textFaint} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}
