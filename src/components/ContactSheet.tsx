import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { Button, Icon } from './ui';

/** Caja de contacto: muestra el correo de soporte con botón para copiarlo. */
export function ContactSheet({ visible, email, onClose }: { visible: boolean; email: string; onClose: () => void }) {
  const { c } = useTheme();
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) setCopied(false);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const copy = async () => {
    const ok = await copyText(email);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <Animated.View entering={FadeIn.duration(motion.fast)} style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
          <Animated.View
            entering={ZoomIn.duration(motion.base).springify().damping(20)}
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: c.elevated, borderColor: c.border }]}
          >
            <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
              <Icon name="mail" size={22} color={c.accent} />
            </View>
            <Text variant="heading">{t('help.contactSheetTitle')}</Text>
            <Text variant="body" tone="muted" style={{ lineHeight: 22 }}>
              {t('help.contactSheetBody')}
            </Text>

            <PressableScale
              onPress={copy}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={`${email}. ${t('help.copy')}`}
              style={[styles.email, { backgroundColor: c.surfaceAlt, borderColor: copied ? c.accent : c.border }]}
            >
              <Text variant="bodyStrong" selectable numberOfLines={1} style={{ flex: 1 }}>
                {email}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name={copied ? 'check' : 'copy'} size={16} color={copied ? c.accent : c.textMuted} />
                <Text variant="caption" style={{ color: copied ? c.accent : c.textMuted, fontWeight: '600' }}>
                  {copied ? t('help.copied') : t('help.copy')}
                </Text>
              </View>
            </PressableScale>

            <View style={styles.buttons}>
              {/* En el escritorio, mailto abre una pestaña en blanco si no hay programa de correo: allí basta con copiar. */}
              {Platform.OS !== 'web' ? (
                <Button title={t('help.contactCta')} icon="send" variant="ghost" onPress={() => Linking.openURL(`mailto:${email}?subject=Clipsy`).catch(() => undefined)} />
              ) : null}
              <Button title={t('common.close')} variant="secondary" onPress={onClose} />
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.md },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  email: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, minHeight: 52, marginTop: space.xs },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
