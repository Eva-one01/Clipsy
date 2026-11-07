import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ContactSheet } from '@/components/ContactSheet';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Icon, IconButton, SectionHeader } from '@/components/ui';
import { intlLocale, type TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { dk } from '@/desktop/licensing';

/** Fecha de la versión vigente de estos textos. Actualízala si cambian. */
const UPDATED = new Date(2026, 9, 26);

const privacy = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const;
const terms = ['t1', 't2', 't3', 't4'] as const;

export default function Legal() {
  const { c } = useTheme();
  const { t } = useT();
  const email = (Constants.expoConfig?.extra as { supportEmail?: string } | undefined)?.supportEmail;
  const [contact, setContact] = useState(false);

  const block = (id: string, i: number) => (
    <Animated.View key={id} entering={FadeInDown.delay(Math.min(i, 6) * 30).duration(motion.base)} style={{ marginBottom: space.lg }}>
      <Text variant="bodyStrong" accessibilityRole="header" style={{ marginBottom: 4 }}>
        {t(`legal.${id}.h` as TKey)}
      </Text>
      <Text variant="body" tone="muted" style={{ lineHeight: 22 }}>
        {t(dk(`legal.${id}.b` as TKey))}
      </Text>
    </Animated.View>
  );

  return (
    <Screen title={t('legal.title')} leading={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />}>
      <Animated.View entering={FadeInDown.duration(motion.slow)}>
        <Card style={{ flexDirection: 'row', gap: space.md, backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
          <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield" size={18} color={c.accent} />
          </View>
          <Text variant="body" style={{ flex: 1, lineHeight: 22 }}>
            {t(dk('legal.summary'))}
          </Text>
        </Card>
      </Animated.View>

      <Text variant="caption" tone="faint" style={{ marginTop: space.md }}>
        {t('legal.updated', { d: new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(UPDATED) })}
      </Text>

      <SectionHeader title={t('legal.privacy')} />
      {privacy.map(block)}

      <SectionHeader title={t('legal.terms')} />
      {terms.map(block)}

      {email ? (
        <Text variant="caption" tone="accent" accessibilityRole="link" onPress={() => setContact(true)} style={{ marginTop: space.sm }}>
          {t('legal.contact', { email })}
        </Text>
      ) : null}
      {email ? <ContactSheet visible={contact} email={email} onClose={() => setContact(false)} /> : null}
    </Screen>
  );
}
