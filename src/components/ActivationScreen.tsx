import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { desktop, type LicenseError } from '@/desktop/bridge';
import { useDesktopState } from '@/desktop/licensing';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { Input } from './Input';
import { Logo } from './Logo';
import { Text } from './Text';
import { Button, Icon } from './ui';

const ERRORS: Record<string, TKey> = {
  invalid: 'lic.err.invalid',
  unconfirmed: 'lic.err.unconfirmed',
  rate: 'lic.err.rate',
  not_purchased: 'lic.err.notPurchased',
  device_limit: 'lic.err.deviceLimit',
  network: 'lic.err.network',
  unconfigured: 'lic.err.unconfigured',
  trial_expired: 'lic.err.trialExpired',
  trial_used: 'lic.err.trialUsed',
};

/**
 * Pantalla de activación (solo escritorio): se inicia sesión con la cuenta de la web con la que se
 * compró Clipsy. Tapa toda la app hasta que la licencia sea válida. Los datos del usuario no se tocan.
 */
export function ActivationScreen() {
  const { c } = useTheme();
  const { t } = useT();
  const license = useDesktopState((s) => s.license);
  const [email, setEmail] = useState(license?.email && license.email !== 'desarrollo' ? license.email : '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: LicenseError; limit?: number } | null>(null);
  const passRef = useRef<TextInput>(null);

  const status = license?.status;
  // Mensaje de contexto según por qué se pide activar.
  const notice: { icon: 'wifi-off' | 'alert-circle' | 'tool' | 'clock'; key: TKey } | null =
    status === 'trial_expired'
      ? { icon: 'clock', key: 'lic.trialOver' }
      : status === 'offline'
      ? { icon: 'wifi-off', key: 'lic.offline' }
      : status === 'revoked'
        ? { icon: 'alert-circle', key: license?.reason === 'not_purchased' ? 'lic.revokedRefund' : 'lic.revokedDevice' }
        : status === 'unconfigured'
          ? { icon: 'tool', key: 'lic.err.unconfigured' }
          : null;

  const submit = async () => {
    if (busy || !desktop?.license) return;
    if (!email.trim() || !password) {
      setError({ code: 'invalid' });
      return;
    }
    setBusy(true);
    setError(null);
    const r = await desktop.license.activate(email, password).catch(() => ({ ok: false, error: 'network' as const, limit: undefined }));
    setBusy(false);
    if (!r.ok) {
      setError({ code: r.error ?? 'generic', limit: r.limit });
      setPassword('');
    }
  };

  const retry = async () => {
    setBusy(true);
    await desktop?.license?.refresh().catch(() => undefined);
    setBusy(false);
  };

  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, zIndex: 500 }]}>
      <KeyboardAvoidingView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(80).springify().damping(20)} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Logo height={28} />
              <Text variant="heading" style={{ letterSpacing: 2 }}>
                CLIPSY
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text variant="title" accessibilityRole="header">
                {t('lic.title')}
              </Text>
              <Text variant="body" tone="muted">
                {t('lic.body')}
              </Text>
              {status !== 'trial_expired' ? (
                <View style={[styles.notice, { backgroundColor: c.accentSoft, marginTop: space.sm }]}>
                  <Icon name="gift" size={16} color={c.accent} />
                  <Text variant="caption" style={{ flex: 1, color: c.accent }}>
                    {t('lic.trialPitch')}
                  </Text>
                </View>
              ) : null}
            </View>

            {notice && (
              <View style={[styles.notice, { backgroundColor: status === 'revoked' ? c.dangerSoft : c.accentSoft }]}>
                <Icon name={notice.icon} size={16} color={status === 'revoked' ? c.danger : c.accent} />
                <Text variant="caption" style={{ flex: 1, color: status === 'revoked' ? c.danger : c.accent }}>
                  {t(notice.key)}
                </Text>
              </View>
            )}

            {status === 'offline' ? (
              <Button title={t('lic.retry')} icon="refresh-cw" onPress={retry} disabled={busy} full />
            ) : null}
            {status === 'trial_expired' ? (
              <View style={{ gap: space.sm }}>
                <Button title={t('lic.buy')} icon="shopping-bag" onPress={() => desktop?.openSite?.('buy')} full />
                <Button title={busy ? t('lic.activating') : t('lic.bought')} icon="refresh-cw" variant="secondary" onPress={retry} disabled={busy} full />
                <Text variant="caption" tone="faint" align="center" style={{ marginTop: space.xs }}>
                  {t('lic.otherAccount')}
                </Text>
              </View>
            ) : null}

            <View style={{ gap: space.md }}>
              <Input
                label={t('lic.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
              />
              <Input
                ref={passRef}
                label={t('lic.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            </View>

            {error && (
              <Animated.View entering={FadeIn.duration(motion.fast)} style={[styles.notice, { backgroundColor: c.dangerSoft }]} accessibilityRole="alert">
                <Icon name="alert-circle" size={16} color={c.danger} />
                <Text variant="caption" style={{ flex: 1, color: c.danger }}>
                  {t(ERRORS[error.code] ?? 'lic.err.generic', { n: error.limit ?? 5 })}
                </Text>
              </Animated.View>
            )}

            <Button title={busy ? t('lic.activating') : t('lic.activate')} variant={status === 'trial_expired' ? 'secondary' : 'primary'} onPress={submit} disabled={busy} full />

            {error?.code === 'not_purchased' || error?.code === 'trial_expired' || error?.code === 'trial_used' ? (
              <Button title={t('lic.buy')} icon="shopping-bag" variant="secondary" onPress={() => desktop?.openSite?.('buy')} full />
            ) : null}
            {error?.code === 'device_limit' ? (
              <Button title={t('lic.manageDevices')} icon="monitor" variant="secondary" onPress={() => desktop?.openSite?.('devices')} full />
            ) : null}

            <View style={styles.links}>
              <Text variant="caption" tone="accent" accessibilityRole="link" onPress={() => desktop?.openSite?.('forgot')}>
                {t('lic.forgot')}
              </Text>
              <Text variant="caption" tone="accent" accessibilityRole="link" onPress={() => desktop?.openSite?.('account')}>
                {t('lic.noAccount')}
              </Text>
            </View>

            <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
              {t('lic.dataSafe')}
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.xxl, gap: space.lg },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, padding: space.md },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
});
