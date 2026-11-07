import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useStore } from '@/store';

/** En escritorio/web no hay motor háptico: todas las llamadas son no-op. */
const enabled = () => Platform.OS !== 'web' && useStore.getState().settings.haptics;

export const haptic = {
  tap() {
    if (enabled()) Haptics.selectionAsync().catch(() => undefined);
  },
  soft() {
    if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  success() {
    if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  warning() {
    if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
};
