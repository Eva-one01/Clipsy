import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH, useIsDesktop } from '@/desktop/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { HEADER_CLOCKS_HEIGHT, HeaderClocks, useHeaderClocks } from './HeaderClocks';
import { Text } from './Text';
import { Icon } from './ui';

export const TAB_BAR_HEIGHT = 62;

interface ScreenProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** true si la pantalla vive dentro de las pestañas (reserva espacio inferior). */
  tabbed?: boolean;
  /** Encabezado propio en lugar del título grande. */
  header?: ReactNode;
  scroll?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  leading?: ReactNode;
  /** Muestra los relojes fijos arriba a la derecha (por defecto sí). */
  clocks?: boolean;
  /** Si se indica, el título se puede pulsar (con una flecha) para abrir un selector. */
  onTitlePress?: () => void;
  titleOpen?: boolean;
  titleHint?: string;
}

/**
 * Contenedor estándar: título grande que se desvanece hacia una barra compacta
 * al desplazarse, con márgenes y espacio para la barra de pestañas.
 */
export function Screen({ title, subtitle, actions, children, tabbed, header, scroll = true, leading, clocks = true, onTitlePress, titleOpen, titleHint }: ScreenProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const y = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [30, 60], [0, 1], Extrapolation.CLAMP),
  }));
  const bigStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 40], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [-80, 0, 60], [12, 0, -8], Extrapolation.CLAMP) }],
  }));

  // En escritorio no hay barra inferior: la navegación va en la barra lateral.
  const bottomPad = (tabbed && !isDesktop ? TAB_BAR_HEIGHT + insets.bottom : insets.bottom) + space.xxxl;
  // En monitores anchos, el contenido se centra con un ancho de lectura cómodo.
  const column = isDesktop ? { width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const } : null;
  const { primary } = useHeaderClocks();
  const showClocks = clocks && !!primary;
  // Los relojes quedan centrados verticalmente en la barra compacta (44 px de alto, píldora de 32).
  const clocksTop = insets.top + 6;
  const [clocksW, setClocksW] = useState(0);
  // El título compacto se centra en el hueco libre entre el botón atrás y los relojes, sin taparse.
  const sideGap = Math.max(leading ? 52 : space.xl, showClocks ? clocksW + space.xl + space.sm : space.xl);
  // Con botón atrás los relojes comparten fila con él; sin él, se reserva una franja encima del título.
  const clockBand = showClocks && !leading ? HEADER_CLOCKS_HEIGHT + space.sm : 0;
  const topPad = (isDesktop ? space.xxxl : space.xl) + clockBand;

  const top = (
    <>
      {header ?? (title ? (
        <Animated.View style={[{ marginBottom: space.lg }, bigStyle]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md }}>
            <View style={{ flex: 1 }}>
              {subtitle ? (
                <Text variant="caption" tone="muted" style={{ marginBottom: 2 }}>
                  {subtitle}
                </Text>
              ) : null}
              {onTitlePress ? (
                <Pressable
                  onPress={onTitlePress}
                  accessibilityRole="button"
                  accessibilityLabel={titleHint ? `${title} · ${titleHint}` : title}
                  accessibilityState={{ expanded: !!titleOpen }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', maxWidth: '100%' }}
                >
                  <Text variant="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flexShrink: 1 }}>
                    {title}
                  </Text>
                  <Icon name={titleOpen ? 'chevron-up' : 'chevron-down'} size={22} color={c.textMuted} />
                </Pressable>
              ) : (
                <Text variant="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {title}
                </Text>
              )}
            </View>
            {actions ? <View style={{ flexDirection: 'row', gap: space.xs }}>{actions}</View> : null}
          </View>
        </Animated.View>
      ) : null)}
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Barra compacta que aparece al hacer scroll */}
      {title && !header ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.compact,
            { paddingTop: insets.top, height: insets.top + 44, backgroundColor: c.bg, borderBottomColor: c.border },
            compactStyle,
          ]}
        >
          <View style={[{ width: '100%', paddingHorizontal: sideGap, alignItems: 'center' }, column]}>
            <Text variant="heading" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {showClocks ? (
        // Capa absoluta a todo el ancho; dentro, la columna centrada: los relojes quedan arriba a la
        // derecha del contenido (en escritorio, un hijo absoluto ignora alignSelf).
        <View pointerEvents="box-none" style={[styles.clocks, { top: clocksTop }]}>
          <View pointerEvents="box-none" style={[{ width: '100%', paddingHorizontal: space.xl, alignItems: 'flex-end' }, column]}>
            <View onLayout={(e) => setClocksW(Math.round(e.nativeEvent.layout.width))}>
              <HeaderClocks />
            </View>
          </View>
        </View>
      ) : null}

      {leading ? <View style={{ position: 'absolute', top: insets.top + 4, left: space.sm, zIndex: 20 }}>{leading}</View> : null}

      {scroll ? (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[{ paddingTop: insets.top + (leading ? 52 : topPad), paddingHorizontal: space.xl, paddingBottom: bottomPad }, column]}
        >
          {top}
          {children}
        </Animated.ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingTop: insets.top + topPad, paddingHorizontal: space.xl }, column]}>
          {top}
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  clocks: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    alignItems: 'center',
  },
  compact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

export { ScrollView };
