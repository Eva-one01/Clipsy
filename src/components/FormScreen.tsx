import { router } from 'expo-router';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsDesktop } from '@/desktop/layout';
import { useT } from '@/i18n/useT';
import { useDialogStore } from '@/lib/dialog';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

interface Props {
  title: string;
  onSave: () => void | Promise<void>;
  canSave: boolean;
  saveLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  hideSave?: boolean;
}

/** Hoja modal estándar: Cancelar · Título · Guardar. */
export function FormScreen({ title, onSave, canSave, saveLabel, children, footer, hideSave }: Props) {
  const { c } = useTheme();
  const { t } = useT();
  const save = saveLabel ?? t('common.save');
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const topPad = isDesktop ? space.md : space.sm;

  const saving = useRef(false);
  const submit = useCallback(async () => {
    if (!canSave || saving.current) return;
    saving.current = true;
    try {
      await onSave();
      if (router.canGoBack()) router.back();
    } catch {
      // onSave lanza para quedarse abierto (el formulario ya muestra el error).
    } finally {
      saving.current = false;
    }
  }, [canSave, onSave]);

  // Escritorio: Esc cierra, Ctrl/⌘ + Intro guarda (salvo si hay un diálogo abierto encima).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (useDialogStore.getState().current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        router.back();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !hideSave) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, hideSave]);

  const body = (
    <>

      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: c.border }]}>
        <PressableScale onPress={() => router.back()} accessibilityLabel={t('common.cancel')} style={styles.side}>
          <Text variant="body" tone="muted" numberOfLines={1}>
            {t('common.cancel')}
          </Text>
        </PressableScale>
        <Text variant="heading" numberOfLines={1} style={{ flex: 1 }} align="center" accessibilityRole="header">
          {title}
        </Text>
        {hideSave ? <View style={styles.side} /> : (
        <PressableScale
          disabled={!canSave}
          accessibilityLabel={save}
          onPress={submit}
          style={[styles.side, { alignItems: 'flex-end' }]}
        >
          <View style={{ backgroundColor: canSave ? c.accent : c.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ color: canSave ? c.onAccent : c.textFaint }}>
              {save}
            </Text>
          </View>
        </PressableScale>
        )}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.xl, paddingBottom: (isDesktop ? 0 : insets.bottom) + space.xxxl, gap: space.xl }}
      >
        {children}
        {footer}
      </ScrollView>
    </>
  );

  // Escritorio: ventana flotante centrada sobre un fondo atenuado (clic fuera = cancelar).
  if (isDesktop) {
    return (
      <Animated.View entering={FadeIn.duration(motion.fast)} style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel={t('common.cancel')} />
        <Animated.View
          entering={ZoomIn.duration(motion.base).springify().damping(22)}
          style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border }]}
        >
          {body}
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }}>
      {body}
    </KeyboardAvoidingView>
  );
}

/** Grupo de filas dentro de un formulario. */
export function FormGroup({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, overflow: 'hidden' }}>
      {children}
    </View>
  );
}

export function FormRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 52,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
        gap: space.md,
      }}
    >
      <Text variant="body">{label}</Text>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  side: { minWidth: 84, paddingVertical: space.xs },
  overlay: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '88%', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
