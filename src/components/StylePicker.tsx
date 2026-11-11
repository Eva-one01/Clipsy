import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useStore } from '@/store';
import type { ClockStyle, ThemePref } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { AccentPicker } from './AccentPicker';
import { Text } from './Text';
import { Icon, type IconName } from './ui';

const THEMES: { v: ThemePref; icon: IconName; label: TKey }[] = [
  { v: 'light', icon: 'sun', label: 'set.light' },
  { v: 'dark', icon: 'moon', label: 'set.dark' },
  { v: 'system', icon: 'monitor', label: 'set.system' },
];
const SIZES: { v: number; label: TKey }[] = [
  { v: 1, label: 'style.sizeNormal' },
  { v: 1.12, label: 'style.sizeLarge' },
  { v: 1.25, label: 'style.sizeXL' },
];
const CLOCKS: { v: ClockStyle; label: TKey }[] = [
  { v: 'digital', label: 'clock.style.digital' },
  { v: 'analog', label: 'clock.style.analog' },
  { v: 'minimal', label: 'clock.style.minimal' },
  { v: 'bold', label: 'clock.style.bold' },
];

/** Botón pequeño (gota de color) en la esquina superior izquierda: tema, color, letra y relojes. */
export function StyleButton() {
  const { c } = useTheme();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('style.title')}
        style={(s) => [styles.btn, { backgroundColor: (s as { hovered?: boolean }).hovered ? c.surfaceAlt : c.accentSoft }]}
      >
        <Icon name="droplet" size={17} color={c.accent} />
      </Pressable>
      {open ? <StylePanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function StylePanel({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const { t } = useT();
  const s = useStore((x) => x.settings);
  const set = useStore((x) => x.setSettings);
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')}>
        <Animated.View entering={FadeIn.duration(motion.fast)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
      </Pressable>
      <Animated.View entering={ZoomIn.duration(motion.base)} style={[styles.panel, { backgroundColor: c.elevated, borderColor: c.borderStrong }]}>
        <Text variant="heading">{t('style.title')}</Text>

        <Text variant="label" tone="faint" upper style={styles.section}>
          {t('style.theme')}
        </Text>
        <View style={styles.row}>
          {THEMES.map((o) => (
            <Choice key={o.v} on={s.theme === o.v} onPress={() => set({ theme: o.v })} icon={o.icon} label={t(o.label)} />
          ))}
        </View>

        <Text variant="label" tone="faint" upper style={styles.section}>
          {t('style.color')}
        </Text>
        <AccentPicker />

        <Text variant="label" tone="faint" upper style={styles.section}>
          {t('style.size')}
        </Text>
        <View style={styles.row}>
          {SIZES.map((o, i) => (
            <Pressable
              key={o.v}
              onPress={() => set({ textScale: o.v })}
              accessibilityRole="radio"
              accessibilityState={{ selected: (s.textScale ?? 1) === o.v }}
              style={[styles.choice, { borderColor: (s.textScale ?? 1) === o.v ? c.accent : c.border, backgroundColor: (s.textScale ?? 1) === o.v ? c.accentSoft : 'transparent' }]}
            >
              <Text variant="bodyStrong" style={{ fontSize: 14 + i * 4, lineHeight: 20 + i * 4 }}>
                Aa
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {t(o.label)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text variant="label" tone="faint" upper style={styles.section}>
          {t('style.clocks')}
        </Text>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {CLOCKS.map((o) => (
            <Choice key={o.v} on={(s.clockStyle ?? 'digital') === o.v} onPress={() => set({ clockStyle: o.v })} label={t(o.label)} />
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

function Choice({ on, onPress, icon, label }: { on: boolean; onPress: () => void; icon?: IconName; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={[styles.choice, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : 'transparent' }]}
    >
      {icon ? <Icon name={icon} size={16} color={on ? c.accent : c.textMuted} /> : null}
      <Text variant="caption" style={{ color: on ? c.text : c.textMuted }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  panel: {
    position: 'absolute',
    top: 64,
    left: 16,
    width: 360,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  section: { marginTop: space.lg, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  choice: { flex: 1, minWidth: 70, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: space.sm, paddingHorizontal: 6, borderRadius: radius.md, borderWidth: 1 },
});
