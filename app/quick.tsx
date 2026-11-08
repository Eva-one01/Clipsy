import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Logo } from '@/components/Logo';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { desktop, voiceKeysLabel } from '@/desktop/bridge';
import { useVoice } from '@/desktop/voice';
import { useT } from '@/i18n/useT';
import { describeQuick, KIND_ICON, runQuick } from '@/lib/quickAdd';
import { parseQuick, type QuickKind } from '@/lib/quickParse';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

const KINDS: QuickKind[] = ['task', 'event', 'reminder', 'alarm', 'expense', 'idea'];
const AUTO_SAVE_MS = 1600; // tras dictar, se guarda solo si nadie corrige el texto

/** Barra de alta rápida del escritorio (Ctrl/⌘+Shift+Espacio desde cualquier programa; Ctrl+Shift+D para dictar). */
export default function Quick() {
  const { c } = useTheme();
  const { t } = useT();
  const currency = useStore((s) => s.settings.currency);
  const lang = useStore((s) => s.settings.language);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<QuickKind | null>(null);
  const [saved, setSaved] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const input = useRef<TextInput>(null);
  // Lo dictado aparece en el campo (se puede corregir) y se guarda solo al momento.
  const voice = useVoice(lang, (said) => {
    setText(said);
    setKind(null);
    setSaved(false);
    setAutoSave(true);
    input.current?.focus();
  });

  const reset = () => {
    setText('');
    setKind(null);
    setSaved(false);
    setAutoSave(false);
    voice.cancel();
    setTimeout(() => input.current?.focus(), 20);
  };

  useEffect(() => desktop?.onQuickOpen?.(reset), []);
  useEffect(() => desktop?.onQuickVoice?.(voice.toggle), [voice.toggle]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Esc primero cancela lo de la voz; si no hay nada, cierra la barra.
        if (autoSave) setAutoSave(false);
        else if (voice.phase === 'listening') voice.cancel();
        else desktop?.hideQuick?.();
      }
      else if (e.key === 'Tab') {
        e.preventDefault();
        setKind((k) => KINDS[(KINDS.indexOf(k ?? (parsed?.kind === 'income' ? 'expense' : parsed?.kind ?? 'task')) + (e.shiftKey ? KINDS.length - 1 : 1)) % KINDS.length]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const auto = text.trim() ? parseQuick(text) : null;
  // Si se elige otro tipo con Tab, se respeta lo interpretado (fecha, hora…) con ese tipo.
  const parsed = auto && kind && kind !== auto.kind && !(kind === 'expense' && auto.kind === 'income') ? withKind(auto, kind) : auto;
  const valid =
    !!parsed && (parsed.kind === 'expense' || parsed.kind === 'income' ? !!parsed.amount : parsed.kind === 'alarm' ? !!parsed.time : !!parsed.title);

  const submit = async () => {
    if (!parsed || !valid) return;
    if (await runQuick(parsed)) {
      setSaved(true);
      setTimeout(() => desktop?.hideQuick?.(), 550);
    }
  };

  useEffect(() => {
    if (!autoSave) return;
    if (!valid) {
      setAutoSave(false); // no se entendió del todo: queda en el campo para completarlo
      return;
    }
    const id = setTimeout(() => {
      setAutoSave(false);
      submit();
    }, AUTO_SAVE_MS);
    return () => clearTimeout(id);
  }, [autoSave, text]);

  const voiceLine = (() => {
    const st = voice.state;
    if (st?.installing) return t('voice.downloading', { p: Math.round(st.progress * 100) });
    if (voice.phase === 'listening') return t('voice.listening');
    if (voice.phase === 'transcribing') return t('voice.transcribing');
    if (voice.needsSetup) return t('voice.setup', { mb: st?.sizeMB ?? 70 });
    if (voice.error === 'no_mic') return t('voice.noMic');
    if (voice.error === 'silence') return t('voice.silence');
    if (voice.error === 'failed') return t('voice.failed');
    if (voice.error === 'install') return t('voice.installFailed');
    return null;
  })();

  return (
    <View style={[styles.root, { backgroundColor: c.elevated, borderColor: c.border }]}>
      {/* La ventana toma la altura del contenido: con letra más grande o escalado de Windows nada se corta. */}
      <View onLayout={(e) => desktop?.setQuickHeight?.(Math.ceil(e.nativeEvent.layout.height) + 2)}>
      <View style={styles.row}>
        <Logo height={20} />
        <TextInput
          ref={input}
          autoFocus
          value={text}
          onChangeText={(v) => {
            setText(v);
            setSaved(false);
            setAutoSave(false);
            voice.clearError();
          }}
          placeholder={t('qa.placeholder')}
          placeholderTextColor={c.textFaint}
          selectionColor={c.accent}
          onSubmitEditing={submit}
          submitBehavior="submit"
          accessibilityLabel={t('qa.placeholder')}
          style={[styles.input, { color: c.text }]}
        />
        {saved ? (
          <Animated.View entering={ZoomIn.duration(motion.base)}>
            <Icon name="check-circle" size={22} color={c.success} />
          </Animated.View>
        ) : voice.available ? (
          <PressableScale
            onPress={voice.needsSetup ? voice.install : voice.toggle}
            accessibilityRole="button"
            accessibilityLabel={voiceKeysLabel() ? `${t('voice.mic')} (${voiceKeysLabel()})` : t('voice.mic')}
            accessibilityState={{ busy: voice.phase !== 'idle' }}
            style={[
              styles.mic,
              {
                backgroundColor: voice.phase === 'listening' ? c.accent : 'transparent',
                borderColor: voice.phase === 'listening' ? c.accent : c.border,
                transform: [{ scale: 1 + voice.level * 0.25 }],
              },
            ]}
          >
            <Icon
              name={voice.phase === 'listening' ? 'square' : voice.phase === 'transcribing' ? 'loader' : 'mic'}
              size={16}
              color={voice.phase === 'listening' ? c.onAccent : c.textMuted}
            />
          </PressableScale>
        ) : null}
      </View>

      <View style={[styles.preview, { borderTopColor: c.border }]}>
        {voiceLine ? (
          <Animated.View entering={FadeIn.duration(motion.fast)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
            <Icon name="mic" size={15} color={voice.error ? c.textFaint : c.accent} />
            <Text variant="caption" tone={voice.error ? 'faint' : 'muted'} numberOfLines={1} style={{ flex: 1 }}>
              {voiceLine}
            </Text>
            {voice.needsSetup && !voice.state?.installing ? (
              <PressableScale onPress={voice.install} accessibilityRole="button" style={[styles.kind, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
                <Text variant="caption" style={{ color: c.text }}>
                  {t('voice.download')}
                </Text>
              </PressableScale>
            ) : null}
          </Animated.View>
        ) : parsed && (parsed.title || parsed.amount || parsed.kind === 'alarm') ? (
          <Animated.View entering={FadeIn.duration(motion.fast)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
            <Icon name={KIND_ICON[parsed.kind]} size={15} color={c.accent} />
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {parsed.title || (parsed.kind === 'alarm' ? t('qa.kind.alarm') : '—')}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {describeQuick(parsed, currency)}
            </Text>
          </Animated.View>
        ) : (
          <Text variant="caption" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
            {t('quick.examples')}
          </Text>
        )}
      </View>

      <View style={styles.kinds}>
        {KINDS.map((k) => {
          const active = (parsed?.kind === 'income' ? 'expense' : parsed?.kind ?? 'task') === k;
          return (
            <PressableScale
              key={k}
              onPress={() => {
                setKind(k);
                input.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.kind, { backgroundColor: active ? c.accentSoft : 'transparent', borderColor: active ? c.accent : c.border }]}
            >
              <Icon name={KIND_ICON[k]} size={12} color={active ? c.accent : c.textMuted} />
              <Text variant="caption" style={{ color: active ? c.text : c.textMuted }}>
                {t(`qa.kind.${k}`)}
              </Text>
            </PressableScale>
          );
        })}
        <Text variant="caption" tone={autoSave ? 'muted' : 'faint'} style={{ marginLeft: 'auto' }}>
          {autoSave ? t('voice.autoSave') : t('quick.keys')}
        </Text>
      </View>
      </View>
    </View>
  );
}

function withKind<T extends ReturnType<typeof parseQuick>>(p: T, kind: QuickKind): T {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const next = { ...p, kind };
  if (kind === 'event' || kind === 'reminder') {
    next.date = p.date ?? today;
    next.time = p.time ?? (kind === 'reminder' ? '09:00' : null);
    if (kind === 'event' && next.time && !next.end) {
      const [h, m] = next.time.split(':').map(Number);
      next.end = h >= 23 ? '23:59' : `${pad(h + 1)}:${pad(m)}`;
    }
  }
  if (kind === 'alarm') next.time = p.time ?? '07:00';
  if (kind === 'expense') next.date = p.date ?? today;
  return next;
}

const styles = StyleSheet.create({
  root: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, height: 72 },
  input: { flex: 1, fontSize: 21, height: '100%', outlineStyle: 'none' } as object,
  preview: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: 2 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 9, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth },
  mic: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
