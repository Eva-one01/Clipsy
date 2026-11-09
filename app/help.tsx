import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ContactSheet } from '@/components/ContactSheet';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Divider, Icon, IconButton, ListRow, SectionHeader } from '@/components/ui';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, space } from '@/theme/tokens';

const QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const layout = LinearTransition.springify().damping(22).stiffness(200);

export default function Help() {
  const { t } = useT();
  const setSettings = useStore((s) => s.setSettings);
  const [open, setOpen] = useState<number | null>(null);
  const [contact, setContact] = useState(false);
  const email = (Constants.expoConfig?.extra as { supportEmail?: string } | undefined)?.supportEmail;

  return (
    <Screen title={t('help.title')} leading={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />}>
      <SectionHeader title={t('help.faq')} />
      <Animated.View layout={layout}>
        <Card padded={false}>
          {QUESTIONS.map((n, i) => (
            <Animated.View key={n} layout={layout}>
              {i > 0 && <Divider inset={space.lg} />}
              <Question
                q={t(`help.q${n}` as TKey)}
                a={t(`help.a${n}` as TKey)}
                open={open === n}
                onToggle={() => {
                  setOpen(open === n ? null : n);
                }}
              />
            </Animated.View>
          ))}
        </Card>
      </Animated.View>

      <Animated.View layout={layout}>
        <SectionHeader title={t('help.more')} />
        <Card padded={false}>
          <ListRow icon="shield" title={t('more.legal')} onPress={() => router.push('/legal')} />
          <Divider inset={58} />
          <ListRow
            icon="play-circle"
            title={t('help.replay')}
            onPress={() => {
              setSettings({ onboarded: false });
              router.dismissAll?.();
              router.replace('/onboarding');
            }}
          />
        </Card>

        {email ? (
          <Card style={{ marginTop: space.xl, gap: space.md, alignItems: 'flex-start' }}>
            <Text variant="heading">{t('help.contactTitle')}</Text>
            <Text variant="body" tone="muted">
              {t('help.contactBody')}
            </Text>
            <Button title={t('help.contactOpen')} icon="mail" variant="secondary" onPress={() => setContact(true)} />
          </Card>
        ) : null}
        {email ? <ContactSheet visible={contact} email={email} onClose={() => setContact(false)} /> : null}
      </Animated.View>
    </Screen>
  );
}

function Question({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  const r = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    r.value = withSpring(open ? 1 : 0, motion.spring);
  }, [open, r]);

  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 180}deg` }] }));

  return (
    <View>
      <PressableScale
        onPress={onToggle}
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={q}
        style={styles.row}
      >
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {q}
        </Text>
        <Animated.View style={chevron}>
          <Icon name="chevron-down" size={18} color={c.textMuted} />
        </Animated.View>
      </PressableScale>
      {open && (
        <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={styles.answer}>
          <Text variant="body" tone="muted" style={{ lineHeight: 22 }}>
            {a}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg, minHeight: 56 },
  answer: { paddingHorizontal: space.lg, paddingBottom: space.lg, marginTop: -space.xs },
});
