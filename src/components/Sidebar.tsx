import { router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { accelKeys, desktop, getShortcuts, modKey, subscribeShortcuts, voiceKeysLabel } from '@/desktop/bridge';
import { useDesktopState } from '@/desktop/licensing';
import { openPalette } from '@/lib/palette';
import { SIDEBAR_WIDTH } from '@/desktop/layout';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { Logo } from './Logo';
import { StyleButton } from './StylePicker';
import { PressableScale } from './PressableScale';
import { TABS, type TabBarProps } from './tabs';
import { Text } from './Text';
import { Icon, type IconName } from './ui';

const ROW_H = 46;
const ROW_GAP = 2;

/** En la web, Pressable también informa de "hovered" (react-native-web). */
type WebPressState = PressableStateCallbackType & { hovered?: boolean };

/** Navegación lateral de escritorio: mismo indicador con muelle que la barra móvil, en vertical. */
export function Sidebar({ state, navigation }: TabBarProps) {
  const { c } = useTheme();
  const { t } = useT();
  const y = useSharedValue(state.index * (ROW_H + ROW_GAP));

  useEffect(() => {
    y.value = withSpring(state.index * (ROW_H + ROW_GAP), motion.spring);
  }, [state.index, y]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  // El atajo de cada sección es el que la persona tenga configurado (Ajustes → Atajos).
  const sc = useSyncExternalStore(subscribeShortcuts, getShortcuts, getShortcuts);
  const hintFor = (route: string, i: number) => {
    const a = sc.find((x) => x.action === `nav:${route === 'index' ? 'index' : route}`)?.accel;
    if (a === undefined) return `${modKey === '⌘' ? '⌘' : 'Ctrl+'}${i + 1}`;
    return accelKeys(a).map((k) => (k === 'Mod' ? (modKey === '⌘' ? '⌘' : 'Ctrl') : k)).join(modKey === '⌘' ? '' : '+');
  };
  // El dictado solo existe en la app de escritorio de Windows (desktop/voice.js).
  const voiceOn = desktop?.platform === 'win32' && !!desktop.openQuickVoice;

  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderRightColor: c.border }]} accessibilityRole="tablist">
      <View style={styles.brand}>
        <Logo height={26} />
        <Text variant="heading" style={{ letterSpacing: 2, flex: 1 }}>
          CLIPSY
        </Text>
        {/* Estilo de la app (tema, color, letra) al alcance desde cualquier pantalla. */}
        <StyleButton />
      </View>

      <View style={styles.ctaRow}>
        <PressableScale
          onPress={() => router.push('/form/task')}
          accessibilityLabel={t('task.new')}
          style={[styles.cta, { backgroundColor: c.accent, flex: 1 }]}
        >
          <Icon name="plus" size={22} color={c.onAccent} />
          <Text variant="heading" style={{ color: c.onAccent, flex: 1 }} numberOfLines={1}>
            {t('task.new')}
          </Text>
          <Text variant="caption" style={{ color: c.onAccent, opacity: 0.7 }}>
            {modKey === '⌘' ? '⌘N' : 'Ctrl+N'}
          </Text>
        </PressableScale>
        {/* Dictar: abre la barra rápida ya escuchando («recuérdame…», «gasté…», «reunión el lunes a las 10»). */}
        {voiceOn ? (
          <PressableScale
            onPress={() => desktop?.openQuickVoice?.()}
            accessibilityRole="button"
            accessibilityLabel={voiceKeysLabel() ? `${t('voice.mic')} (${voiceKeysLabel()})` : t('voice.mic')}
            style={[styles.mic, { backgroundColor: c.accentSoft, borderColor: c.accent }]}
          >
            <Icon name="mic" size={21} color={c.accent} />
          </PressableScale>
        ) : null}
      </View>

      <Pressable
        onPress={() => openPalette()}
        accessibilityRole="search"
        accessibilityLabel={t('qa.search')}
        style={(s: WebPressState) => [styles.search, { borderColor: c.border, backgroundColor: s.hovered ? c.surfaceAlt : 'transparent' }]}
      >
        <Icon name="search" size={15} color={c.textMuted} />
        <Text variant="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
          {t('qa.search')}
        </Text>
        <Text variant="caption" tone="faint">
          {modKey === '⌘' ? '⌘K' : 'Ctrl+K'}
        </Text>
      </Pressable>

      <View style={{ position: 'relative' }}>
        <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: c.accentSoft }, pill]} />
        {state.routes.map((route, i) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === i;
          const label = t(meta.label);
          return (
            <NavRow
              key={route.key}
              icon={meta.icon}
              label={label}
              hint={hintFor(route.name, i)}
              focused={focused}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <TrialCard />

      <NavRow icon="upload" label={t('import.nav')} onPress={() => router.push('/import')} />
      <NavRow icon="help-circle" label={t('help.title')} onPress={() => router.push('/help')} />
      <NavRow icon="settings" label={t('common.settings')} hint={modKey === '⌘' ? '⌘,' : 'Ctrl+,'} onPress={() => router.push('/settings')} />
    </View>
  );
}

/** Durante la prueba gratuita: días que quedan y botón de compra. */
function TrialCard() {
  const { c } = useTheme();
  const { t } = useT();
  const ends = useDesktopState((s) => s.license?.trialEndsAt);
  if (!ends) return null;
  const days = Math.max(0, Math.ceil((ends - Date.now()) / 86_400_000));
  const urgent = days <= 2;
  return (
    <View style={[styles.trial, { backgroundColor: urgent ? c.warningSoft : c.accentSoft }]}>
      <Text variant="caption" style={{ fontWeight: '700', color: c.text }}>
        {t('trial.title')}
      </Text>
      <Text variant="caption" tone="muted">
        {days <= 0 ? t('trial.lastDay') : t('trial.daysLeft', { n: days })}
      </Text>
      <PressableScale onPress={() => desktop?.openSite?.('buy')} accessibilityRole="button" style={[styles.trialBtn, { backgroundColor: c.accent }]}>
        <Text variant="caption" style={{ color: c.onAccent, fontWeight: '700' }}>
          {t('trial.buy')}
        </Text>
      </PressableScale>
    </View>
  );
}

function NavRow({ icon, label, hint, focused, onPress }: { icon: IconName; label: string; hint?: string; focused?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!focused }}
      accessibilityLabel={label}
      style={(s: WebPressState) => [
        styles.row,
        { backgroundColor: !focused && (hover || s.hovered) ? c.surfaceAlt : 'transparent', opacity: s.pressed ? 0.75 : 1 },
      ]}
    >
      <Icon name={icon} size={20} color={focused ? c.accent : c.textMuted} />
      <Text variant="body" numberOfLines={1} style={{ flex: 1, color: focused ? c.text : c.textMuted, fontWeight: focused ? '800' : '600' }}>
        {label}
      </Text>
      {hint && (hover || focused) ? (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingTop: space.xl,
    paddingBottom: space.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, marginBottom: space.xl },
  ctaRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  mic: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 40, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginTop: -space.sm, marginBottom: space.lg },
  trial: { borderRadius: radius.md, padding: space.md, gap: 4, marginBottom: space.md },
  trialBtn: { marginTop: 6, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 0, left: 0, right: 0, height: ROW_H, borderRadius: radius.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: ROW_H,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    marginBottom: ROW_GAP,
  },
});
