import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Divider, Icon, IconButton, SectionHeader, type IconName } from '@/components/ui';
import { categoryLabel } from '@/constants/finance';
import { desktop, type ImportFile } from '@/desktop/bridge';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { relativeDay, weekdayName } from '@/lib/date';
import { interpret, type ImportGoal, type ImportItem } from '@/lib/importParse';
import { runImport } from '@/lib/importRun';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

const GOALS: { key: ImportGoal; icon: IconName }[] = [
  { key: 'routine', icon: 'repeat' },
  { key: 'agenda', icon: 'calendar' },
  { key: 'tasks', icon: 'check-square' },
  { key: 'finance', icon: 'dollar-sign' },
];
const AFTER: Record<ImportGoal, string> = { routine: '/calendar', agenda: '/calendar', tasks: '/lists', finance: '/finance' };
type Step = 'choose' | 'reading' | 'review' | 'done';
type Fail = Exclude<ImportFile, { ok: true }>['error'];

/**
 * Importar lo que la persona ya tiene (rutina, horario, agenda, tareas o finanzas) desde Excel, CSV, Word,
 * PDF, texto o una foto. El archivo se lee en el equipo y no se guarda: se muestra lo que se entendió
 * para revisarlo antes de añadirlo.
 */
export default function Import() {
  const { c, isDark } = useTheme();
  const { t, lang } = useT();
  const currency = useStore((s) => s.settings.currency);
  const [goal, setGoal] = useState<ImportGoal | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState<Fail | null>(null);
  const [file, setFile] = useState('');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const canPick = !!desktop?.importer;

  const choose = async () => {
    if (!goal || !desktop?.importer) return;
    setError(null);
    setStep('reading');
    const res = await desktop.importer.pick(lang).catch(() => ({ ok: false, error: 'read' }) as ImportFile);
    if (!res.ok) {
      setStep('choose');
      if (res.error !== 'canceled') setError(res.error);
      return;
    }
    setFile(res.name);
    setItems(interpret(res.rows, goal));
    setOff(new Set());
    setStep('review');
  };

  const chosen = useMemo(() => items.filter((i) => !off.has(i.key)), [items, off]);

  const confirm = async () => {
    if (!chosen.length) return;
    setBusy(true);
    const n = await runImport(chosen);
    setBusy(false);
    setAdded(n);
    setStep('done');
  };

  const toggle = (k: string) => {
    setOff((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  // En finanzas, tocar el tipo cambia gasto ↔ ingreso (un extracto no siempre lo dice).
  const flip = (k: string) =>
    setItems((list) => list.map((i) => (i.key === k && (i.type === 'expense' || i.type === 'income') ? { ...i, type: i.type === 'expense' ? 'income' : 'expense', category: i.type === 'expense' ? 'other_in' : 'other' } : i)));

  const restart = () => {
    setStep('choose');
    setItems([]);
    setError(null);
  };

  const describe = (it: ImportItem) => {
    const bits: string[] = [];
    if (it.type === 'event' && it.repeat !== 'none') {
      bits.push(it.repeat === 'daily' ? t('import.everyDay') : it.repeat === 'weekdays' ? t('import.weekdays') : it.days.map((d) => weekdayName(d, 'short')).join(', '));
    } else if (it.date) bits.push(relativeDay(it.date));
    if (it.start) bits.push(it.end ? `${it.start}–${it.end}` : it.start);
    if (it.category && (it.type === 'expense' || it.type === 'income')) bits.push(categoryLabel(it.category));
    return bits.join(' · ');
  };

  return (
    <Screen title={t('import.title')} leading={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />}>
      {step === 'choose' || step === 'reading' ? (
        <>
          <Animated.View entering={FadeInDown.duration(motion.base)} style={[styles.lead, { backgroundColor: c.accentSoft }]}>
            <View style={[styles.leadIcon, { backgroundColor: c.accent }]}>
              <Icon name="upload" size={20} color={c.onAccent} />
            </View>
            <Text variant="heading" align="center">
              {t('import.lead')}
            </Text>
            <Text variant="body" tone="muted" align="center" style={{ maxWidth: 520 }}>
              {t('import.leadSub')}
            </Text>
          </Animated.View>

          <SectionHeader title={t('import.what')} />
          <View style={styles.goals}>
            {GOALS.map((g) => {
              const on = goal === g.key;
              return (
                <PressableScale
                  key={g.key}
                  onPress={() => {
                    setGoal(g.key);
                    setError(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.goal, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.border }]}
                >
                  <Icon name={g.icon} size={20} color={on ? c.accent : c.textMuted} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{t(`import.goal.${g.key}` as TKey)}</Text>
                    <Text variant="caption" tone="muted">
                      {t(`import.goal.${g.key}Sub` as TKey)}
                    </Text>
                  </View>
                  <Icon name={on ? 'check-circle' : 'circle'} size={18} color={on ? c.accent : c.textFaint} />
                </PressableScale>
              );
            })}
          </View>

          <View style={styles.note}>
            <Icon name="file-text" size={15} color={c.textMuted} />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              {t('import.formats')}
            </Text>
          </View>

          {error ? (
            <Animated.View entering={FadeIn.duration(motion.fast)} style={[styles.error, { backgroundColor: c.dangerSoft }]}>
              <Icon name="alert-circle" size={16} color={c.danger} />
              <Text variant="caption" style={{ color: c.danger, flex: 1 }}>
                {t(`import.err.${error}` as TKey)}
              </Text>
            </Animated.View>
          ) : null}

          <View style={{ marginTop: space.lg, gap: space.sm }}>
            {canPick ? (
              step === 'reading' ? (
                <View style={[styles.reading, { borderColor: c.border }]}>
                  <ActivityIndicator color={c.accent} />
                  <Text variant="body" tone="muted">
                    {t('import.reading')}
                  </Text>
                </View>
              ) : (
                // Blanco para que destaque del resto (que va en el color de acento).
                <PressableScale
                  onPress={choose}
                  disabled={!goal}
                  accessibilityRole="button"
                  accessibilityLabel={goal ? t('import.choose') : t('import.pickFirst')}
                  style={[styles.white, { borderColor: isDark ? 'transparent' : c.borderStrong, opacity: goal ? 1 : 0.5 }]}
                >
                  <Icon name="folder" size={18} color="#0E0E10" />
                  <Text variant="bodyStrong" style={{ color: '#0E0E10' }}>
                    {goal ? t('import.choose') : t('import.pickFirst')}
                  </Text>
                </PressableScale>
              )
            ) : (
              <Text variant="body" tone="muted">
                {t('import.desktopOnly')}
              </Text>
            )}
            <View style={styles.note}>
              <Icon name="lock" size={14} color={c.textFaint} />
              <Text variant="caption" tone="faint" style={{ flex: 1 }}>
                {t('import.privacy')}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {step === 'review' ? (
        <Animated.View entering={FadeInDown.duration(motion.base)}>
          <View style={styles.reviewHead}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading" numberOfLines={1}>
                {file}
              </Text>
              <Text variant="caption" tone="muted">
                {items.length ? t('import.found', { n: items.length }) : t('import.nothing')}
              </Text>
            </View>
            <Button title={t('import.another')} variant="ghost" onPress={choose} />
          </View>

          {items.length ? (
            <>
              <Text variant="caption" tone="faint" style={{ marginBottom: space.sm }}>
                {goal === 'finance' ? t('import.reviewFinance') : t('import.review')}
              </Text>
              <Card padded={false}>
                {items.map((it, i) => {
                  const on = !off.has(it.key);
                  const money = it.type === 'expense' || it.type === 'income';
                  return (
                    <View key={it.key}>
                      {i > 0 && <Divider inset={52} />}
                      <View style={[styles.item, { opacity: on ? 1 : 0.45 }]}>
                        <Pressable onPress={() => toggle(it.key)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={it.title} hitSlop={8}>
                          <Icon name={on ? 'check-square' : 'square'} size={20} color={on ? c.accent : c.textFaint} />
                        </Pressable>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text variant="bodyStrong" numberOfLines={1}>
                            {it.title}
                          </Text>
                          {describe(it) ? (
                            <Text variant="caption" tone="muted" numberOfLines={1}>
                              {describe(it)}
                            </Text>
                          ) : null}
                        </View>
                        {money && it.amount ? (
                          <Pressable onPress={() => flip(it.key)} accessibilityRole="button" accessibilityLabel={t('import.flip')} hitSlop={6}>
                            <Text variant="bodyStrong" tabular style={{ color: it.type === 'income' ? c.success : c.text }}>
                              {(it.type === 'income' ? '+' : '−') + formatMoney(it.amount, currency)}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
              <View style={{ marginTop: space.lg, gap: space.sm }}>
                <Button title={busy ? t('import.adding') : t('import.add', { n: chosen.length })} onPress={confirm} disabled={!chosen.length || busy} full />
                <Button title={t('common.cancel')} variant="ghost" onPress={restart} full />
              </View>
            </>
          ) : (
            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Text variant="body" tone="muted">
                {t('import.nothingSub')}
              </Text>
              <Button title={t('import.changeType')} variant="ghost" onPress={restart} />
            </View>
          )}
        </Animated.View>
      ) : null}

      {step === 'done' ? (
        <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.done}>
          <View style={[styles.leadIcon, { backgroundColor: c.successSoft, width: 56, height: 56, borderRadius: 28 }]}>
            <Icon name="check" size={26} color={c.success} />
          </View>
          <Text variant="title" align="center">
            {t('import.done', { n: added })}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {t('import.doneSub')}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button title={t('import.see')} onPress={() => goal && router.navigate(AFTER[goal] as never)} />
            <Button title={t('import.more')} variant="ghost" onPress={restart} />
          </View>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { gap: space.sm, padding: space.xl, borderRadius: radius.lg, alignItems: 'center' },
  leadIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  goal: { flexBasis: '48%', flexGrow: 1, minWidth: 240, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.md },
  white: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  reading: { height: 50, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  done: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl },
});
