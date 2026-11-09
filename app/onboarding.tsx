import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccentPicker } from '@/components/AccentPicker';
import { Logo } from '@/components/Logo';
import { PressableScale } from '@/components/PressableScale';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { Button, Icon, type IconName } from '@/components/ui';
import { languages, type TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useStore } from '@/store';
import type { ThemePref } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

type Step = { id: 'lang' | 'intro' | 'lifetime' | 'privacy' | 'theme'; icon: IconName; title: TKey; body: TKey };

const steps: Step[] = [
  { id: 'lang', icon: 'globe', title: 'onb.lang.title', body: 'onb.lang.body' },
  { id: 'intro', icon: 'sun', title: 'onb.1.title', body: 'onb.1.body' },
  { id: 'lifetime', icon: 'key', title: 'onb.life.title', body: 'onb.life.body' },
  { id: 'privacy', icon: 'shield', title: 'onb.2.title', body: 'onb.2.body' },
  { id: 'theme', icon: 'moon', title: 'onb.3.title', body: 'onb.3.body' },
];

export default function Onboarding() {
  const { c } = useTheme();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  // Dirección del último cambio: 1 = avanzar (entra por la derecha), -1 = volver.
  const [dir, setDir] = useState<1 | -1>(1);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const step = steps[i];
  const last = i === steps.length - 1;

  // Cierre: el contenido se retira y el logotipo aparece centrado antes de entrar a la app.
  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      setSettings({ onboarded: true });
      router.replace('/');
    }, 950);
  };

  const go = (to: number) => {
    if (leaving || to < 0 || to >= steps.length) return;
    setDir(to > i ? 1 : -1);
    setI(to);
  };

  const next = () => (last ? finish() : go(i + 1));

  // Entrada escalonada: icono, título, texto y controles llegan uno tras otro.
  const enter = (k: number) =>
    (dir > 0 ? FadeInRight : FadeInLeft)
      .delay(90 + k * 55)
      .springify()
      .damping(20)
      .stiffness(170);
  const exit = (dir > 0 ? FadeOutLeft : FadeOutRight).duration(200).easing(Easing.out(Easing.quad));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xxl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 }}>
        {i > 0 ? (
          <PressableScale onPress={() => go(i - 1)} accessibilityLabel={t('common.back')} hitSlop={12}>
            <Icon name="arrow-left" size={20} color={c.textMuted} />
          </PressableScale>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Logo height={24} />
            <Text variant="heading" style={{ letterSpacing: 2 }}>
              CLIPSY
            </Text>
          </View>
        )}
        {i > 0 && !last && (
          <Text variant="body" tone="muted" accessibilityRole="button" onPress={finish}>
            {t('onb.skip')}
          </Text>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {!leaving && (
        <Animated.View key={step.id} exiting={exit} style={[StyleSheet.absoluteFill, { justifyContent: 'center', gap: space.lg }]}>
          <Animated.View entering={enter(0)} style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={step.icon} size={28} color={c.accent} />
          </Animated.View>
          <Animated.View entering={enter(1)}>
            <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }} accessibilityRole="header">
              {t(step.title)}
            </Text>
          </Animated.View>
          <Animated.View entering={enter(2)}>
            <Text variant="body" tone="muted" style={{ fontSize: 17, lineHeight: 25 }}>
              {t(step.body)}
            </Text>
          </Animated.View>

          {step.id === 'lang' && (
            <Animated.View entering={enter(3)} style={[styles.langList, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="radiogroup">
              {languages.map((l, k) => {
                const sel = l.code === lang;
                return (
                  <PressableScale
                    key={l.code}
                    scaleTo={0.985}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={l.native}
                    onPress={() => {
                      setSettings({ language: l.code });
                    }}
                    style={[styles.langRow, { borderTopWidth: k ? StyleSheet.hairlineWidth : 0, borderTopColor: c.border }]}
                  >
                    <Text variant="body" style={{ flex: 1, fontWeight: sel ? '600' : '400' }}>
                      {l.native}
                    </Text>
                    {sel && (
                      <Animated.View entering={FadeIn.duration(motion.fast)}>
                        <Icon name="check" size={18} color={c.accent} />
                      </Animated.View>
                    )}
                  </PressableScale>
                );
              })}
            </Animated.View>
          )}

          {step.id === 'privacy' && (
            <Animated.View entering={enter(3)}>
            <Text variant="body" tone="accent" accessibilityRole="link" onPress={() => router.push('/legal')}>
              {t('onb.2.link')}
            </Text>
            </Animated.View>
          )}

          {step.id === 'theme' && (
            <Animated.View entering={enter(3)} style={{ marginTop: space.md }}>
              <Segmented<ThemePref>
                value={theme}
                onChange={(v) => setSettings({ theme: v })}
                options={[
                  { value: 'system', label: t('set.system') },
                  { value: 'light', label: t('set.light') },
                  { value: 'dark', label: t('set.dark') },
                ]}
              />
              <View style={{ marginTop: space.xl }}>
                <AccentPicker />
              </View>
            </Animated.View>
          )}
        </Animated.View>
        )}
      </View>

      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }} accessibilityLabel={t('onb.step', { n: i + 1, total: steps.length })}>
          {steps.map((s, k) => (
            <Animated.View
              key={s.id}
              layout={LinearTransition.springify().damping(18)}
              style={{ height: 6, width: k === i ? 22 : 6, borderRadius: 3, backgroundColor: k === i ? c.text : c.borderStrong }}
            />
          ))}
        </View>
        <Button title={last ? t('onb.start') : t('onb.continue')} onPress={next} full disabled={leaving} />
      </View>

      {leaving && (
        <Animated.View
          entering={FadeIn.duration(motion.base)}
          style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg }]}
          pointerEvents="none"
        >
          <Animated.View entering={ZoomIn.delay(140).springify().damping(16).stiffness(180)}>
            <Logo height={64} />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(300).duration(motion.slow)}>
            <Text variant="heading" style={{ letterSpacing: 6 }}>
              CLIPSY
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  langList: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginTop: space.sm },
  langRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: space.lg },
});
