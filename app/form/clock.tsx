import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { FormScreen } from '@/components/FormScreen';
import { Input } from '@/components/Input';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { Card, Divider, Icon } from '@/components/ui';
import { cities, cityName } from '@/constants/cities';
import { useT } from '@/i18n/useT';
import { formatOffset, isValidTz, offsetFromLocal, zoned } from '@/lib/timezone';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Option {
  key: string;
  cityId?: string;
  name: string;
  tz: string;
}

export default function ClockPicker() {
  const { c } = useTheme();
  const { t, lang } = useT();
  const clocks = useStore((s) => s.clocks);
  const addClock = useStore((s) => s.addClock);
  const [q, setQ] = useState('');

  const results = useMemo<Option[]>(() => {
    const n = norm(q.trim());
    // Se busca en los nombres de todos los idiomas y en la zona IANA.
    const base: Option[] = cities
      .filter((x) => !n || norm(`${x.names.join(' ')} ${x.tz}`).includes(n))
      .map((x) => ({ key: x.id, cityId: x.id, name: cityName(x, lang), tz: x.tz }));
    const raw = q.trim();
    if (raw.includes('/') && isValidTz(raw) && !base.some((b) => b.tz === raw)) {
      return [{ key: raw, name: raw.split('/').pop()!.replace(/_/g, ' '), tz: raw }, ...base];
    }
    return base;
  }, [q, lang]);

  const pick = (o: Option) => {
    addClock({ tz: o.tz, city: o.name, cityId: o.cityId });
    router.back();
  };

  const now = new Date();

  return (
    <FormScreen title={t('clocks.pickerTitle')} canSave={false} hideSave onSave={() => undefined}>
      <Input placeholder={t('clocks.search')} value={q} onChangeText={setQ} autoFocus autoCorrect={false} clearButtonMode="while-editing" />
      <Card padded={false}>
        {results.length === 0 ? (
          <Text variant="body" tone="muted" style={{ padding: space.lg }}>
            {t('clocks.noResults')}
          </Text>
        ) : (
          results.map((o, i) => {
            const added = clocks.some((x) => x.tz === o.tz && (x.cityId ?? x.city) === (o.cityId ?? o.name));
            const z = zoned(o.tz, now);
            return (
              <View key={o.key}>
                {i > 0 && <Divider inset={space.lg} />}
                <PressableScale
                  disabled={added}
                  onPress={() => pick(o)}
                  scaleTo={0.985}
                  accessibilityLabel={`${o.name}${added ? `, ${t('clocks.added')}` : ''}`}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="body">{o.name}</Text>
                    <Text variant="caption" tone="faint">
                      {formatOffset(offsetFromLocal(o.tz, now))}
                    </Text>
                  </View>
                  <Text variant="bodyStrong" tabular tone="muted">
                    {String(z.hour).padStart(2, '0')}:{String(z.minute).padStart(2, '0')}
                  </Text>
                  {added && <Icon name="check" size={16} color={c.accent} />}
                </PressableScale>
              </View>
            );
          })
        )}
      </Card>
    </FormScreen>
  );
}
