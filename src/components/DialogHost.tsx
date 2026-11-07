import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { resolveDialog, useDialogStore, type DialogButton } from '@/lib/dialog';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** Muestra los diálogos de showDialog() en escritorio/web. En móvil no renderiza nada. */
export function DialogHost() {
  const { c } = useTheme();
  const current = useDialogStore((s) => s.current);

  const cancel = current?.buttons.find((b) => b.style === 'cancel');
  const primary = current ? [...current.buttons].reverse().find((b) => b.style !== 'cancel') : undefined;

  useEffect(() => {
    if (Platform.OS !== 'web' || !current) return;
    // Esc = cancelar, Intro = acción principal (si solo hay un botón no cancelable).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveDialog(cancel);
      if (e.key === 'Enter' && primary && current.buttons.filter((b) => b.style !== 'cancel').length === 1) resolveDialog(primary);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, cancel, primary]);

  if (Platform.OS !== 'web' || !current) return null;

  // Orden de botones: cancelar a la izquierda, acciones a la derecha (o apilados si son muchos).
  const ordered: DialogButton[] = [...current.buttons.filter((b) => b.style === 'cancel'), ...current.buttons.filter((b) => b.style !== 'cancel')];
  const stacked = ordered.length > 2;

  return (
    <Animated.View entering={FadeIn.duration(motion.fast)} exiting={FadeOut.duration(motion.fast)} style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.overlay }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => resolveDialog(cancel)} accessibilityLabel={cancel?.text} />
      <Animated.View
        entering={ZoomIn.duration(motion.base).springify().damping(20)}
        accessibilityRole="alert"
        style={[styles.card, { backgroundColor: c.elevated, borderColor: c.border }]}
      >
        <Text variant="heading">{current.title}</Text>
        {current.message ? (
          <Text variant="body" tone="muted" style={{ lineHeight: 22 }}>
            {current.message}
          </Text>
        ) : null}
        <View style={[styles.buttons, stacked && { flexDirection: 'column-reverse', alignItems: 'stretch' }]}>
          {ordered.map((b, i) => {
            const isPrimary = b === primary;
            const danger = b.style === 'destructive';
            const bg = danger ? c.dangerSoft : isPrimary ? c.accent : c.surfaceAlt;
            const fg = danger ? c.danger : isPrimary ? c.onAccent : c.text;
            return (
              <PressableScale
                key={`${b.text}-${i}`}
                onPress={() => resolveDialog(b)}
                accessibilityLabel={b.text}
                style={{ backgroundColor: bg, borderRadius: radius.md, paddingHorizontal: space.lg, height: 40, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text variant="bodyStrong" style={{ color: fg }}>
                  {b.text}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1000, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.md },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
});
