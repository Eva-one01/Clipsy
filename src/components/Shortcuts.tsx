import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { accelKeys, desktop, getShortcuts, modKey, setShortcutList, subscribeShortcuts, type ShortcutInfo } from '@/desktop/bridge';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Text } from './Text';
import { Card, Divider, Icon } from './ui';

/** Qué hace cada atajo (las acciones vienen de desktop/shortcuts.js). */
const LABEL: Record<string, TKey | [TKey, TKey]> = {
  'open:search': 'desk.sc.search',
  quick: 'desk.sc.quick',
  voice: 'desk.sc.voice',
  mini: 'desk.sc.mini',
  'new:task': 'desk.sc.task',
  'new:event': 'desk.sc.event',
  'nav:index': ['sc.goTo', 'tabs.today'],
  'nav:calendar': ['sc.goTo', 'tabs.calendar'],
  'nav:lists': ['sc.goTo', 'tabs.lists'],
  'nav:finance': ['sc.goTo', 'tabs.finance'],
  'nav:more': ['sc.goTo', 'tabs.more'],
  'open:settings': 'desk.sc.settings',
};
/** Fijos: son convenciones de los formularios. */
const FIXED: [string[], TKey][] = [
  [['Mod', 'Enter'], 'desk.sc.save'],
  [['Esc'], 'desk.sc.close'],
];
/** Sin la app de escritorio (web): solo el buscador. */
const WEB_DEFAULT: ShortcutInfo[] = [{ action: 'open:search', accel: 'CommandOrControl+K', def: 'CommandOrControl+K', global: false, busy: false }];

// KeyboardEvent.code → nombre de tecla de Electron.
const CODE: Record<string, string> = {
  Space: 'Space', Tab: 'Tab', Enter: 'Return', NumpadEnter: 'Return', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Minus: '-', Equal: '=', Backquote: '`', NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
};
function keyName(code: string): string | null {
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code);
  if (m) return `num${m[1]}`;
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  return CODE[code] ?? null;
}
const isMac = desktop?.platform === 'darwin';
function modsOf(e: KeyboardEvent): string[] {
  const out: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) out.push('CommandOrControl');
  if (isMac && e.ctrlKey) out.push('Control');
  if (e.altKey) out.push('Alt');
  if (e.shiftKey) out.push('Shift');
  return out;
}

/** Atajos de la app de escritorio. Se tocan para cambiarlos (se guardan en el equipo). */
export function ShortcutsCard() {
  const { c } = useTheme();
  const { t } = useT();
  const list = useSyncExternalStore(subscribeShortcuts, getShortcuts, getShortcuts);
  const editable = !!desktop?.shortcuts;
  const rows = (editable ? list : WEB_DEFAULT).filter((s) => s.action !== 'voice' || desktop?.platform === 'win32');
  const [recording, setRecording] = useState<string | null>(null);
  const [live, setLive] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ action: string; text: string; ok?: boolean } | null>(null);

  const label = (action: string) => {
    const l = LABEL[action];
    if (!l) return action;
    return Array.isArray(l) ? t(l[0], { name: t(l[1]) }) : t(l);
  };

  const stop = () => {
    setRecording(null);
    setLive([]);
    desktop?.shortcuts?.pause(false);
  };

  const save = async (action: string, accel: string) => {
    const res = await desktop!.shortcuts!.set(action, accel);
    setShortcutList(res.list);
    setRecording(null);
    setLive([]);
    if (res.ok) {
      setMsg({ action, text: accel ? t('sc.saved') : t('sc.removed'), ok: true });
    } else {
      desktop?.shortcuts?.pause(false);
      setMsg({ action, text: res.error === 'duplicate' && res.with ? t('sc.duplicate', { name: label(res.with) }) : t(`sc.err.${res.error}` as TKey) });
    }
  };

  // Grabar la combinación: se capturan las teclas antes que nadie (incluida la propia app).
  useEffect(() => {
    if (!recording || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) return stop();
      const mods = modsOf(e);
      if ((e.key === 'Backspace' || e.key === 'Delete') && !mods.length) return void save(recording, '');
      const key = keyName(e.code);
      if (!key) {
        setLive(mods); // solo modificadores por ahora: se muestran mientras se mantienen
        return;
      }
      if (!mods.some((m) => m !== 'Shift') && !/^F\d+$/.test(key)) {
        setLive([...mods, key]);
        setMsg({ action: recording, text: t('sc.err.invalid') });
        return;
      }
      void save(recording, [...mods, key].join('+'));
    };
    const onUp = (e: KeyboardEvent) => setLive(modsOf(e));
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, [recording]);

  // Si se sale de la pantalla grabando, los atajos vuelven a funcionar.
  useEffect(() => () => desktop?.shortcuts?.pause(false), []);

  const start = (action: string) => {
    setMsg(null);
    setLive([]);
    setRecording(action);
    desktop?.shortcuts?.pause(true);
  };

  const reset = async () => {
    const next = await desktop!.shortcuts!.reset();
    setShortcutList(next);
    setMsg(null);
  };

  return (
    <>
      {editable ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: space.sm }}>
          {t('sc.hint')}
        </Text>
      ) : null}
      <Card padded={false}>
        {rows.map((s, i) => {
          const rec = recording === s.action;
          const keys = rec ? (live.length ? accelKeys(live.join('+')) : null) : accelKeys(s.accel);
          return (
            <View key={s.action}>
              {i > 0 && <Divider inset={space.lg} />}
              <View style={styles.shortcut}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{label(s.action)}</Text>
                  {msg?.action === s.action ? (
                    <Animated.View entering={FadeIn}>
                      <Text variant="caption" style={{ color: msg.ok ? c.success : c.danger }}>
                        {msg.text}
                      </Text>
                    </Animated.View>
                  ) : s.busy ? (
                    <Text variant="caption" style={{ color: c.danger }}>
                      {t('sc.busy')}
                    </Text>
                  ) : s.global ? (
                    <Text variant="caption" tone="faint">
                      {t('sc.global')}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => (rec ? stop() : editable ? start(s.action) : undefined)}
                  disabled={!editable}
                  accessibilityRole="button"
                  accessibilityLabel={`${label(s.action)}: ${rec ? t('sc.press') : s.accel ? accelKeys(s.accel).join('+') : t('sc.none')}`}
                  style={(st) => [
                    styles.edit,
                    {
                      borderColor: rec ? c.accent : (st as { hovered?: boolean }).hovered && editable ? c.borderStrong : 'transparent',
                      backgroundColor: rec ? c.accentSoft : 'transparent',
                    },
                  ]}
                >
                  {rec && !keys ? (
                    <Text variant="caption" style={{ color: c.accent }}>
                      {t('sc.press')}
                    </Text>
                  ) : keys && keys.length ? (
                    <Kbd keys={keys} />
                  ) : (
                    <Text variant="caption" tone="faint">
                      {t('sc.none')}
                    </Text>
                  )}
                  {editable && !rec ? <Icon name="edit-2" size={12} color={c.textFaint} /> : null}
                </Pressable>
              </View>
            </View>
          );
        })}
        {FIXED.map(([keys, fixedLabel]) => (
          <View key={fixedLabel}>
            <Divider inset={space.lg} />
            <View style={styles.shortcut}>
              <Text variant="body" style={{ flex: 1 }}>
                {t(fixedLabel)}
              </Text>
              <View style={[styles.edit, { borderColor: 'transparent' }]}>
                <Kbd keys={keys} />
              </View>
            </View>
          </View>
        ))}
      </Card>
      {editable ? (
        <Pressable onPress={reset} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: space.sm, paddingVertical: 4 }}>
          <Text variant="caption" style={{ color: c.accent }}>
            {t('sc.reset')}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

function Kbd({ keys }: { keys: string[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {keys.map((k, i) => (
        <View key={`${k}${i}`} style={[styles.kbd, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
          <Text variant="caption" tabular>
            {k === 'Mod' ? modKey : k === 'Shift' ? (modKey === '⌘' ? '⇧' : 'Shift') : k === 'Enter' || k === 'Return' ? '↵' : k === 'Control' ? 'Ctrl' : k}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52, paddingVertical: 6 },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 6, borderRadius: radius.sm, borderWidth: 1 },
  kbd: { minWidth: 26, height: 24, paddingHorizontal: 6, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
