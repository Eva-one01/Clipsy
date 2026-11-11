import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { cities, cityName, findCity, nearestCity } from '@/constants/cities';
import { desktop, type WeatherResult } from '@/desktop/bridge';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { Dropdown } from './Dropdown';
import { Text } from './Text';
import { Icon, type IconName } from './ui';

const REFRESH = 30 * 60 * 1000;

/** Símbolo de MET Norway («partlycloudy_day», «lightrain»…) → icono y texto. */
function look(symbol: string): { icon: IconName; label: TKey } {
  const s = symbol.replace(/_(day|night|polartwilight)$/, '');
  const night = symbol.endsWith('_night');
  if (/thunder/.test(s)) return { icon: 'cloud-lightning', label: 'weather.thunder' };
  if (/snow|sleet/.test(s)) return { icon: 'cloud-snow', label: 'weather.snow' };
  if (/drizzle|lightrain/.test(s)) return { icon: 'cloud-drizzle', label: 'weather.drizzle' };
  if (/rain/.test(s)) return { icon: 'cloud-rain', label: 'weather.rain' };
  if (/fog/.test(s)) return { icon: 'wind', label: 'weather.fog' };
  if (s === 'cloudy') return { icon: 'cloud', label: 'weather.cloudy' };
  if (s === 'partlycloudy' || s === 'fair') return { icon: 'cloud', label: 'weather.partly' };
  return { icon: night ? 'moon' : 'sun', label: 'weather.clear' };
}

/** Clima de la ubicación (arriba a la izquierda en «Hoy»). Desactivado hasta que la persona lo pide. */
export function WeatherWidget() {
  const { c } = useTheme();
  const { t, lang } = useT();
  const pref = useStore((s) => s.settings.weather);
  const set = useStore((s) => s.setSettings);
  const [data, setData] = useState<WeatherResult | null>(null);
  const [open, setOpen] = useState(false);
  const api = desktop?.weather;

  const load = useCallback(async () => {
    if (!api || !pref?.enabled) return;
    const city = pref.source === 'city' ? findCity(pref.cityId) : undefined;
    const res = await api.get(city && city.lat !== undefined && city.lon !== undefined ? { source: 'city', lat: city.lat, lon: city.lon } : { source: 'auto' }).catch(() => null);
    if (res) setData(res);
  }, [api, pref?.enabled, pref?.source, pref?.cityId]);

  useEffect(() => {
    setData(null);
    load();
    const id = setInterval(load, REFRESH);
    return () => clearInterval(id);
  }, [load]);

  if (!api) return null;

  const place = (() => {
    if (pref?.source === 'city') {
      const city = findCity(pref.cityId);
      return city ? cityName(city, lang) : '';
    }
    if (data?.ok) {
      const near = nearestCity(data.lat, data.lon);
      return near ? cityName(near, lang) : t('weather.here');
    }
    return t('weather.here');
  })();
  const w = data?.ok ? look(data.symbol) : null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={pref?.enabled && data?.ok && w ? `${t(w.label)}, ${data.temp}°, ${place}` : t('weather.enable')}
        style={(s) => [styles.pill, { backgroundColor: (s as { hovered?: boolean }).hovered ? c.surfaceAlt : c.surface, borderColor: c.border }]}
      >
        {pref?.enabled && data?.ok && w ? (
          <>
            <Icon name={w.icon} size={18} color={c.accent} />
            <Text variant="bodyStrong" tabular>
              {data.temp}°
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: 160 }}>
              {place}
            </Text>
          </>
        ) : pref?.enabled && !data ? (
          <Text variant="caption" tone="muted">
            {t('weather.loading')}
          </Text>
        ) : (
          <>
            <Icon name="cloud" size={16} color={c.textMuted} />
            <Text variant="caption" tone="muted">
              {pref?.enabled ? t('weather.unavailable') : t('weather.enable')}
            </Text>
          </>
        )}
      </Pressable>
      {open ? (
        <Modal transparent visible animationType="none" onRequestClose={() => setOpen(false)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel={t('common.close')}>
            <Animated.View entering={FadeIn.duration(motion.fast)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
          </Pressable>
          <Animated.View entering={ZoomIn.duration(motion.base)} style={[styles.panel, { backgroundColor: c.elevated, borderColor: c.borderStrong }]}>
            {pref?.enabled && data?.ok && w ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Icon name={w.icon} size={36} color={c.accent} />
                <View style={{ flex: 1 }}>
                  <Text variant="title" tabular>
                    {data.temp}° · {t(w.label)}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {place}
                    {data.min !== null && data.max !== null ? ` · ${t('weather.range', { min: data.min, max: data.max })}` : ''}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text variant="heading">{t('weather.title')}</Text>
                {pref?.enabled && data && !data.ok ? (
                  <Text variant="caption" style={{ color: c.danger, marginTop: space.xs }}>
                    {t(`weather.err.${data.error}` as TKey)}
                  </Text>
                ) : null}
              </>
            )}

            <Text variant="caption" tone="muted" style={{ marginTop: space.md }}>
              {t('weather.privacy')}
            </Text>

            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Pressable
                onPress={() => set({ weather: { enabled: true, source: 'auto' } })}
                accessibilityRole="radio"
                accessibilityState={{ selected: !!pref?.enabled && pref.source === 'auto' }}
                style={[styles.option, { borderColor: pref?.enabled && pref.source === 'auto' ? c.accent : c.border, backgroundColor: pref?.enabled && pref.source === 'auto' ? c.accentSoft : 'transparent' }]}
              >
                <Icon name="navigation" size={16} color={c.accent} />
                <Text variant="body" style={{ flex: 1 }}>
                  {t('weather.useLocation')}
                </Text>
              </Pressable>
              <Dropdown
                label={t('weather.city')}
                icon="map-pin"
                value={pref?.enabled && pref.source === 'city' && pref.cityId ? pref.cityId : ''}
                options={[{ value: '', label: t('weather.pickCity') }, ...cities.filter((x) => x.lat !== undefined).map((x) => ({ value: x.id, label: cityName(x, lang) })).sort((a, b) => a.label.localeCompare(b.label))]}
                onChange={(v) => v && set({ weather: { enabled: true, source: 'city', cityId: v } })}
              />
              {pref?.enabled ? (
                <Pressable onPress={() => set({ weather: { enabled: false, source: pref.source, cityId: pref.cityId ?? null } })} style={{ paddingVertical: 6 }} accessibilityRole="button">
                  <Text variant="caption" style={{ color: c.danger }}>
                    {t('weather.off')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text variant="caption" tone="faint" style={{ marginTop: space.sm }}>
              {t('weather.credit')}
            </Text>
          </Animated.View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start' },
  panel: {
    position: 'absolute',
    top: 96,
    left: 300,
    width: 380,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
