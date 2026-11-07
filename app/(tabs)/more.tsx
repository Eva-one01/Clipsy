import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ContactSheet } from '@/components/ContactSheet';
import { Logo } from '@/components/Logo';
import { desktop } from '@/desktop/bridge';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Divider, ListRow, SectionHeader } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useStore } from '@/store';
import { motion, space } from '@/theme/tokens';

export default function More() {
  const { t } = useT();
  const clocks = useStore((s) => s.clocks.length);
  const alarms = useStore((s) => s.alarms.filter((a) => a.enabled).length);
  const reminders = useStore((s) => s.reminders.filter((r) => !r.done && r.at > Date.now()).length);
  const extra = Constants.expoConfig?.extra as { supportEmail?: string } | undefined;
  // Soporte abre la caja de contacto (correo + copiar): abrir mailto directamente deja una pestaña
  // en blanco si el sistema no tiene un programa de correo configurado.
  const [contact, setContact] = useState(false);

  return (
    <Screen tabbed title={t('more.title')}>
      <Animated.View entering={FadeInDown.duration(motion.base)}>
        <SectionHeader title={t('more.tools')} />
        <Card padded={false}>
          <ListRow icon="clipboard" title={t('review.title')} subtitle={t('review.subtitle')} onPress={() => router.push('/review')} />
          <Divider inset={58} />
          <ListRow icon="clock" title={t('more.clocks')} value={String(clocks)} onPress={() => router.push('/clocks')} />
          <Divider inset={58} />
          <ListRow
            icon="bell"
            title={t('more.alarms')}
            value={alarms + reminders ? t('more.active', { n: alarms + reminders }) : undefined}
            onPress={() => router.push('/alarms')}
          />
        </Card>

        <SectionHeader title={t('more.app')} />
        <Card padded={false}>
          <ListRow icon="settings" title={t('common.settings')} subtitle={t('more.settingsSub')} onPress={() => router.push('/settings')} />
          <Divider inset={58} />
          <ListRow icon="help-circle" title={t('more.help')} onPress={() => router.push('/help')} />
          <Divider inset={58} />
          <ListRow icon="shield" title={t('more.legal')} onPress={() => router.push('/legal')} />
          {extra?.supportEmail ? (
            <>
              <Divider inset={58} />
              <ListRow icon="mail" title={t('more.support')} onPress={() => setContact(true)} />
            </>
          ) : null}
        </Card>

        <View style={{ alignItems: 'center', marginTop: space.xxxl, gap: 4 }}>
          <View style={{ marginBottom: space.sm }}>
            <Logo height={44} />
          </View>
          <Text variant="heading" style={{ letterSpacing: 3 }}>
            CLIPSY
          </Text>
          <Text variant="caption" tone="faint">
            {desktop
              ? t('more.version', { v: desktop.version, b: desktop.platform === 'darwin' ? 'macOS' : desktop.platform === 'win32' ? 'Windows' : 'Linux' })
              : t('more.version', { v: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0', b: Application.nativeBuildVersion ?? '—' })}
          </Text>
          <Text variant="caption" tone="faint">
            {t('more.localOnly')}
          </Text>
        </View>
      </Animated.View>
      {extra?.supportEmail ? <ContactSheet visible={contact} email={extra.supportEmail} onClose={() => setContact(false)} /> : null}
    </Screen>
  );
}
