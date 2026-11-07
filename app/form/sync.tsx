import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { enableSync, remoteInfo } from '@/desktop/sync';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const ERR: Record<string, TKey> = {
  wrong_passphrase: 'sync.err.wrong',
  network: 'sync.err.network',
  no_license: 'sync.err.license',
  device_removed: 'sync.err.license',
  trial_expired: 'sync.err.license',
  too_large: 'sync.err.tooLarge',
};

/** Activar la sincronización cifrada: crear la frase (primer equipo) o escribirla (los demás). */
export default function SyncForm() {
  const { c } = useTheme();
  const { t } = useT();
  const [mode, setMode] = useState<'loading' | 'create' | 'join' | 'offline'>('loading');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    remoteInfo().then((r) => setMode(r.error ? 'offline' : r.exists ? 'join' : 'create'));
  }, []);

  const valid = mode === 'join' ? pass.length > 0 : mode === 'create' && pass.length >= 8 && pass === pass2;

  const save = async () => {
    setBusy(true);
    setError(null);
    const err = await enableSync(pass).catch(() => 'generic');
    setBusy(false);
    if (err) {
      setError(err);
      throw new Error(err);
    }
  };

  return (
    <FormScreen title={t('sync.title')} canSave={valid && !busy} saveLabel={busy ? t('sync.working') : t('sync.enable')} onSave={save}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={17} color={c.accent} />
        </View>
        <Text variant="body" tone="muted" style={{ flex: 1, lineHeight: 22 }}>
          {t('sync.intro')}
        </Text>
      </View>

      {mode === 'loading' ? (
        <ActivityIndicator color={c.accent} style={{ marginVertical: space.xl }} />
      ) : mode === 'offline' ? (
        <Text variant="body" style={{ color: c.danger }}>
          {t('sync.err.network')}
        </Text>
      ) : (
        <Animated.View entering={FadeIn} style={{ gap: space.md }}>
          <Text variant="bodyStrong">{mode === 'join' ? t('sync.joinTitle') : t('sync.createTitle')}</Text>
          <Input
            label={t('sync.passphrase')}
            value={pass}
            onChangeText={setPass}
            secureTextEntry
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            hint={mode === 'create' ? t('sync.passHint') : undefined}
          />
          {mode === 'create' ? (
            <Input label={t('sync.passphrase2')} value={pass2} onChangeText={setPass2} secureTextEntry autoCapitalize="none" autoCorrect={false} error={pass2 && pass !== pass2 ? t('sync.mismatch') : undefined} />
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm, backgroundColor: c.warningSoft, borderRadius: radius.md, padding: space.md }}>
            <Icon name="alert-triangle" size={15} color={c.warning} />
            <Text variant="caption" style={{ flex: 1, color: c.text }}>
              {mode === 'join' ? t('sync.joinNote') : t('sync.forgetNote')}
            </Text>
          </View>
        </Animated.View>
      )}

      {error ? (
        <Text variant="caption" style={{ color: c.danger }} accessibilityRole="alert">
          {t(ERR[error] ?? 'sync.err.generic')}
        </Text>
      ) : null}
    </FormScreen>
  );
}
