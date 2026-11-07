import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivationScreen } from '@/components/ActivationScreen';
import { CommandPalette } from '@/components/CommandPalette';
import { DialogHost } from '@/components/DialogHost';
import { UpdateBanner } from '@/components/UpdateBanner';
import { auxWindow } from '@/desktop/aux';
import { useCrossWindowSync } from '@/desktop/crossWindow';
import { useAutoSync } from '@/desktop/sync';
import { useDesktopStateSync, useLicenseGate } from '@/desktop/licensing';
import { useDesktopIntegration } from '@/desktop/useDesktopIntegration';
import { useExactAlarmWatcher } from '@/lib/exactAlarms';
import { configureNotifications, useNotificationRouting } from '@/lib/notifications';
import { useStore } from '@/store';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 300, fade: true });

function RootStack() {
  const { c, isDark } = useTheme();
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.settings.onboarded);
  useDesktopStateSync();
  const gate = useLicenseGate();
  useAutoSync(hydrated && gate === 'open');

  useNotificationRouting(hydrated);
  useDesktopIntegration(hydrated);
  useCrossWindowSync(hydrated);

  const reschedule = useCallback(() => {
    useStore.getState().rescheduleAll().catch(() => undefined);
  }, []);
  useExactAlarmWatcher(reschedule, hydrated);

  useEffect(() => {
    configureNotifications().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  // Gastos e ingresos fijos: se registran al abrir y, con la app abierta, una vez por hora.
  useEffect(() => {
    if (!hydrated || auxWindow) return;
    const run = () => useStore.getState().postDueRecurring();
    run();
    const id = setInterval(run, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [hydrated]);

  if (!hydrated) return null;

  // Formularios: hoja modal en iOS, deslizante en Android y ventana flotante en escritorio
  // (FormScreen dibuja el fondo atenuado y la animación en la web).
  const modal =
    Platform.OS === 'web'
      ? { presentation: 'transparentModal' as const, animation: 'none' as const, contentStyle: { backgroundColor: 'transparent' } }
      : {
          presentation: Platform.OS === 'ios' ? ('modal' as const) : ('card' as const),
          animation: Platform.OS === 'ios' ? ('default' as const) : ('slide_from_bottom' as const),
          gestureEnabled: true,
        };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} animated />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="clocks" />
        <Stack.Screen name="alarms" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="help" />
        <Stack.Screen name="review" />
        <Stack.Screen name="mini" options={{ animation: 'none' }} />
        <Stack.Screen name="quick" options={{ animation: 'none', contentStyle: { backgroundColor: c.elevated } }} />
        <Stack.Screen name="form/event" options={modal} />
        <Stack.Screen name="form/task" options={modal} />
        <Stack.Screen name="form/goal" options={modal} />
        <Stack.Screen name="form/transaction" options={modal} />
        <Stack.Screen name="form/alarm" options={modal} />
        <Stack.Screen name="form/reminder" options={modal} />
        <Stack.Screen name="form/clock" options={modal} />
        <Stack.Screen name="form/recurring" options={modal} />
        <Stack.Screen name="form/budgets" options={modal} />
        <Stack.Screen name="form/sync" options={modal} />
      </Stack>
      {/* Escritorio: tras la introducción, la app pide activar la licencia. Tus datos siguen intactos debajo. */}
      {gate === 'loading' ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, zIndex: 500 }} /> : null}
      {gate === 'gate' && onboarded ? <ActivationScreen /> : null}
      {gate === 'open' && !auxWindow ? <UpdateBanner /> : null}
      {gate === 'open' && onboarded && !auxWindow ? <CommandPalette /> : null}
      <DialogHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
