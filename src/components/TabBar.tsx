import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius } from '@/theme/tokens';
import { useIsDesktop } from '@/desktop/layout';
import { TAB_BAR_HEIGHT } from './Screen';
import { Sidebar } from './Sidebar';
import { Text } from './Text';
import { TABS, type TabBarProps } from './tabs';
import { Icon } from './ui';

/** Geometría compartida: la píldora y la caja del icono miden y se posicionan igual. */
const TOP = 8;
const PILL_W = 56;
const PILL_H = 32;
const ICON = 20;

/** Escritorio: barra lateral. Móvil: barra inferior. */
export function TabBar(props: TabBarProps) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <Sidebar {...props} /> : <BottomBar {...props} />;
}

/** Barra inferior propia: indicador que se desliza con muelle y háptica por pestaña. */
function BottomBar({ state, navigation }: TabBarProps) {
  const { c } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const tabW = w / state.routes.length;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(state.index * tabW, motion.spring);
  }, [state.index, tabW, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom, backgroundColor: c.bg, borderTopColor: c.border }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {w > 0 && (
        <Animated.View style={[styles.pillTrack, { width: tabW }, pill]} pointerEvents="none">
          <View style={[styles.pill, { backgroundColor: c.accentSoft }]} />
        </Animated.View>
      )}
      {state.routes.map((route, i) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        const label = t(meta.label);
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !ev.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={styles.tab}
          >
            <View style={styles.iconBox}>
              <Icon name={meta.icon} size={ICON} color={focused ? c.accent : c.textMuted} style={styles.icon} />
            </View>
            <Text
              variant="label"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ color: focused ? c.text : c.textFaint, letterSpacing: 0.2, marginTop: 4, fontSize: 10.5, paddingHorizontal: 2 }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pillTrack: { position: 'absolute', top: TOP, left: 0, height: PILL_H, alignItems: 'center' },
  pill: { width: PILL_W, height: PILL_H, borderRadius: radius.pill },
  tab: { flex: 1, alignItems: 'center', paddingTop: TOP },
  iconBox: { width: PILL_W, height: PILL_H, alignItems: 'center', justifyContent: 'center' },
  // Con altura de línea fija, el glifo queda centrado de verdad.
  icon: { lineHeight: ICON, height: ICON, includeFontPadding: false, textAlignVertical: 'center' },
});
