import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { desktop } from '@/desktop/bridge';
import { useDesktopState } from '@/desktop/licensing';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Text } from './Text';
import { Icon } from './ui';

/** Atributos data-* en la web (react-native-web los pasa con `dataSet`; los tipos de RN no lo incluyen). */
const web = (dataSet: Record<string, string>) => ({ dataSet }) as object;

/** Ancho de los botones del sistema (minimizar, maximizar, cerrar) que Windows dibuja encima a la derecha. */
const CONTROLS_W = 140;

/** Alto de la barra de título propia (0 si esta ventana no la tiene). */
export const titleBarHeight = desktop?.titleBar ?? 0;

/**
 * Barra de título de la ventana principal en Windows. Se puede arrastrar como la del sistema y,
 * cuando hay una actualización, muestra un botón junto a minimizar para instalarla.
 */
export function TitleBar() {
  const { c, isDark } = useTheme();
  const { t } = useT();
  const update = useDesktopState((s) => s.update);

  // Los botones del sistema toman los colores del tema de la app.
  useEffect(() => {
    desktop?.setTitleBar?.(c.bg, isDark ? '#F2F2F0' : '#0E0E10');
  }, [c.bg, isDark]);

  // Zona para arrastrar la ventana (y lo que no debe arrastrar: el botón).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'razor-titlebar-css';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = '[data-titlebar]{-webkit-app-region:drag;user-select:none}[data-nodrag]{-webkit-app-region:no-drag}';
    document.head.appendChild(el);
  }, []);

  const ready = update?.status === 'ready';
  const downloading = update?.status === 'downloading';
  const show = !!update?.version && (ready || downloading);

  // El punto late suave cuando ya se puede actualizar.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = ready ? withRepeat(withSequence(withTiming(0.35, { duration: 900 }), withTiming(1, { duration: 900 })), -1) : withTiming(1);
  }, [ready, pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View {...web({ titlebar: '1' })} style={[styles.bar, { height: titleBarHeight, backgroundColor: c.bg }]}>
      <View style={{ flex: 1 }} />
      {show ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} {...web({ nodrag: '1' })} style={{ marginRight: space.sm }}>
          <Pressable
            onPress={() => ready && desktop?.updates?.install()}
            accessibilityRole="button"
            accessibilityLabel={ready ? t('upd.barReady', { v: update!.version ?? '' }) : t('upd.barDownloading', { v: update!.version ?? '', p: update!.progress ?? 0 })}
            style={(st) => [
              styles.btn,
              {
                backgroundColor: ready ? ((st as { hovered?: boolean }).hovered ? c.accent : c.accentSoft) : 'transparent',
                borderColor: ready ? c.accent : c.border,
              },
            ]}
          >
            {(st) => {
              const hovered = (st as { hovered?: boolean }).hovered;
              return (
              <>
                <View>
                  <Icon name="download-cloud" size={15} color={ready && hovered ? c.onAccent : c.accent} />
                  {ready ? <Animated.View style={[styles.dot, { backgroundColor: c.accent, borderColor: c.bg }, dot]} /> : null}
                </View>
                <Text variant="caption" style={{ fontWeight: '600', color: ready && hovered ? c.onAccent : ready ? c.text : c.textMuted }}>
                  {ready ? t('upd.barShort') : `${update!.progress ?? 0} %`}
                </Text>
              </>
              );
            }}
          </Pressable>
        </Animated.View>
      ) : null}
      <View style={{ width: CONTROLS_W }} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  dot: { position: 'absolute', top: -2, right: -3, width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
});
