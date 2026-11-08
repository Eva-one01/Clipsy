import { StyleSheet, View } from 'react-native';
import { desktop, modKey, voiceKeys } from '@/desktop/bridge';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Text } from './Text';
import { Card, Divider } from './ui';

/** Atajos de la app de escritorio (definidos en desktop/main.js). "Mod" = ⌘ en Mac, Ctrl en Windows. */
const SHORTCUTS: [string[], TKey][] = [
  [['Mod', 'K'], 'desk.sc.search'],
  [['Mod', 'Shift', 'Space'], 'desk.sc.quick'],
  [['Mod', 'Alt', 'D'], 'desk.sc.voice'],
  [['Mod', 'Shift', 'T'], 'desk.sc.mini'],
  [['Mod', '1 – 5'], 'desk.sc.nav'],
  [['Mod', 'N'], 'desk.sc.task'],
  [['Mod', 'Shift', 'N'], 'desk.sc.event'],
  [['Mod', ','], 'desk.sc.settings'],
  [['Mod', 'Enter'], 'desk.sc.save'],
  [['Esc'], 'desk.sc.close'],
];

export function ShortcutsCard() {
  const { t } = useT();
  return (
    <Card padded={false}>
      {/* El dictado por voz solo existe en Windows (desktop/voice.js) y se muestra el atajo que se pudo registrar. */}
      {SHORTCUTS.filter(([, label]) => label !== 'desk.sc.voice' || (desktop?.platform === 'win32' && !!voiceKeys()))
        .map(([keys, label]): [string[], TKey] => [label === 'desk.sc.voice' ? (voiceKeys() ?? keys) : keys, label])
        .map(([keys, label], i) => (
        <View key={label}>
          {i > 0 && <Divider inset={space.lg} />}
          <View style={styles.shortcut}>
            <Text variant="body" style={{ flex: 1 }}>
              {t(label)}
            </Text>
            <Kbd keys={keys} />
          </View>
        </View>
      ))}
    </Card>
  );
}

function Kbd({ keys }: { keys: string[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {keys.map((k) => (
        <View key={k} style={[styles.kbd, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
          <Text variant="caption" tabular>
            {k === 'Mod' ? modKey : k === 'Shift' ? (modKey === '⌘' ? '⇧' : 'Shift') : k === 'Enter' ? '↵' : k}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 48 },
  kbd: { minWidth: 26, height: 24, paddingHorizontal: 6, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
