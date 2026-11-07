import { requireOptionalNativeModule } from 'expo';
import { useEffect } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { t } from '@/i18n';

/** Módulo nativo local: modules/razor-alarms (solo Android). */
interface RazorAlarmsNative {
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): boolean;
}

const Native = Platform.OS === 'android' ? requireOptionalNativeModule<RazorAlarmsNative>('RazorAlarms') : null;

/** true si el sistema permite alarmas exactas (o si la plataforma no lo requiere). */
export function canScheduleExactAlarms(): boolean {
  try {
    return Native ? Native.canScheduleExactAlarms() : true;
  } catch {
    return true;
  }
}

/** Abre el ajuste "Alarmas y recordatorios" de Razor. Devuelve false si no se pudo. */
export function openExactAlarmSettings(): boolean {
  try {
    return Native ? Native.openExactAlarmSettings() : false;
  } catch {
    return false;
  }
}

let askedThisSession = false;

/**
 * Tras guardar una alarma o recordatorio: si faltan alarmas exactas, lo explica una vez por sesión
 * y ofrece abrir el ajuste. No bloquea el guardado.
 */
export function promptExactAlarmsIfNeeded() {
  if (askedThisSession || canScheduleExactAlarms()) return;
  askedThisSession = true;
  Alert.alert(t('exact.title'), t('exact.body'), [
    { text: t('exact.later'), style: 'cancel' },
    { text: t('exact.allow'), onPress: () => { if (!openExactAlarmSettings()) Linking.openSettings(); } },
  ]);
}

/**
 * Al volver a la app, si el permiso pasó de denegado a concedido, llama a onGranted
 * (reprogramar notificaciones para que pasen a ser exactas).
 */
export function useExactAlarmWatcher(onGranted: () => void, enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    let last = canScheduleExactAlarms();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = canScheduleExactAlarms();
      if (now && !last) onGranted();
      last = now;
    });
    return () => sub.remove();
  }, [onGranted, enabled]);
}
