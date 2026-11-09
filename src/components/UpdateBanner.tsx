import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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

  // «Actualizado»: se va solo a los pocos segundos.
  const updatedTo = update?.updatedTo;
  useEffect(() => {
    if (!updatedTo) return;
    const id = setTimeout(() => desktop?.updates?.dismiss?.(), 9000);
    return () => clearTimeout(id);
  }, [updatedTo]);

  if (!desktop?.updates || !update) return null;

  // 1) Instalando: la ventana se cerrará en un momento.
  if (update.status === 'installing') {
    return (
      <Box c={c} icon={<ActivityIndicator size="small" color={c.accent} />} title={t('upd.installingTitle', { v: update.version ?? '' })} body={t('upd.installingBody')} />
    );
  }

  // 2) Plan B: se intentó instalar y la app volvió a abrir con la versión anterior.
  if (update.failedTo) {
    const canRetry = update.status === 'ready' && update.version === update.failedTo;
    return (
      <Box
        c={c}
        tone="danger"
        icon={<Icon name="alert-triangle" size={18} color={c.danger} />}
        title={t('upd.failedTitle', { v: update.failedTo })}
        body={t('upd.failedBody')}
        onClose={() => desktop?.updates?.dismiss?.()}
        closeLabel={t('upd.later')}
      >
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
          {canRetry ? <Button title={t('upd.retry')} onPress={() => desktop?.updates?.install({ visible: true })} /> : null}
          <Button title={t('upd.getInstaller')} variant={canRetry ? 'secondary' : 'primary'} onPress={() => desktop?.updates?.download?.()} />
        </View>
      </Box>
    );
  }

  // 3) Recién actualizada.
  if (update.updatedTo) {
    return (
      <Box
        c={c}
        tone="success"
        icon={<Icon name="check-circle" size={18} color={c.success} />}
        title={t('upd.updatedTitle', { v: update.updatedTo })}
        body={t('upd.updatedBody')}
        onClose={() => desktop?.updates?.dismiss?.()}
        closeLabel={t('common.close')}
      />
    );
  }

  const ready = update.status === 'ready';
  const manual = update.status === 'available' && update.manual;
  // Se avisa en cuanto se detecta la versión nueva (al abrir la app), no solo cuando ya está descargada.
  const downloading = update.status === 'downloading';
  if (!update.version || (!ready && !manual && !downloading) || hidden === update.version) return null;

  return (
    <Box
      c={c}
      icon={<Icon name="download-cloud" size={18} color={c.accent} />}
      title={t('upd.newTitle', { v: update.version })}
      body={ready ? t('upd.readyBody') : downloading ? t('upd.downloadingBody', { p: update.progress ?? 0 }) : t('upd.manualBody')}
      onClose={() => setHidden(update.version ?? null)}
      closeLabel={t('upd.later')}
    >
      {downloading ? (
        <View style={[styles.bar, { backgroundColor: c.surfaceAlt }]}>
          <View style={{ width: `${Math.max(4, update.progress ?? 0)}%`, height: '100%', borderRadius: 2, backgroundColor: c.accent }} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', marginTop: space.sm }}>
          <Button title={ready ? t('upd.restart') : t('upd.download')} onPress={() => desktop?.updates?.install()} />
        </View>
      )}
    </Box>
  );
}

function Box({
  c,
  tone,
  icon,
  title,
  body,
  children,
  onClose,
  closeLabel,
}: {
  c: ReturnType<typeof useTheme>['c'];
  tone?: 'success' | 'danger';
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const soft = tone === 'success' ? c.successSoft : tone === 'danger' ? c.dangerSoft : c.accentSoft;
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.slow).springify().damping(20)}
      exiting={FadeOutDown.duration(motion.base)}
      style={[styles.box, { backgroundColor: c.elevated, borderColor: c.borderStrong }]}
      accessibilityRole="alert"
    >
      <View style={[styles.icon, { backgroundColor: soft }]}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
        {children}
      </View>
      {onClose ? <IconButton icon="x" label={closeLabel ?? ''} size={30} onPress={onClose} /> : null}
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
  bar: { height: 4, borderRadius: 2, marginTop: space.sm, overflow: 'hidden' },
});
