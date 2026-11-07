import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { categoryLabel } from '@/constants/finance';
import { desktop, modKey } from '@/desktop/bridge';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { formatClock, relativeDay, toKey } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import { closePalette, openPalette, usePalette } from '@/lib/palette';
import { describeQuick, KIND_ICON, runQuick } from '@/lib/quickAdd';
import { parseQuick } from '@/lib/quickParse';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { Text } from './Text';
import { Icon, type IconName } from './ui';

interface Item {
  id: string;
  icon: IconName;
  title: string;
  sub?: string;
  group: TKey;
  run: () => void | Promise<void>;
  /** Texto en el que se busca (ya normalizado). */
  hay: string;
}

const norm = (s: string) => {
  let x = s.toLowerCase();
  try {
    x = x.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    /* sin normalize: se busca tal cual */
  }
  return x;
};

const go = (href: Parameters<typeof router.push>[0], tab = false) => () => {
  closePalette();
  // Deja que el modal se cierre antes de navegar (evita que el formulario quede debajo).
  setTimeout(() => (tab ? router.navigate(href) : router.push(href)), 10);
};

/**
 * Búsqueda global y alta rápida (Ctrl/⌘+K). Busca en tareas, eventos, ideas, metas, recordatorios
 * y movimientos; si lo escrito parece algo nuevo («dentista el viernes a las 4»), lo crea con Intro.
 */
export function CommandPalette() {
  const { c } = useTheme();
  const { t } = useT();
  const { open, initial } = usePalette();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  const tasks = useStore((s) => s.tasks);
  const events = useStore((s) => s.events);
  const ideas = useStore((s) => s.ideas);
  const goals = useStore((s) => s.goals);
  const reminders = useStore((s) => s.reminders);
  const txs = useStore((s) => s.transactions);
  const recurring = useStore((s) => s.recurring);
  const currency = useStore((s) => s.settings.currency);
  const use24h = useStore((s) => s.settings.use24h);
  const onboarded = useStore((s) => s.settings.onboarded);

  // Ctrl/⌘+K abre o cierra desde cualquier pantalla (en escritorio y en la web).
  useEffect(() => {
    // En la app de escritorio el atajo lo gestiona el menú (desktop/main.js) para no abrirse dos veces.
    if (Platform.OS !== 'web' || !onboarded || desktop) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (usePalette.getState().open) closePalette();
        else openPalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onboarded]);

  useEffect(() => {
    if (open) {
      setQ(initial);
      setSel(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open, initial]);

  const actions: Item[] = useMemo(() => {
    const a: [IconName, TKey, Parameters<typeof router.push>[0], boolean?][] = [
      ['check-square', 'task.new', '/form/task'],
      ['calendar', 'qa.newEvent', '/form/event'],
      ['bell', 'alarms.newReminder', '/form/reminder'],
      ['minus-circle', 'tx.new', '/form/transaction'],
      ['repeat', 'rec.new', '/form/recurring'],
      ['sliders', 'bud.title', '/form/budgets'],
      ['clipboard', 'review.title', '/review'],
      ['sun', 'tabs.today', '/', true],
      ['calendar', 'tabs.calendar', '/calendar', true],
      ['check-square', 'tabs.lists', '/lists', true],
      ['pie-chart', 'tabs.finance', '/finance', true],
      ['clock', 'more.clocks', '/clocks'],
      ['bell', 'more.alarms', '/alarms'],
      ['settings', 'common.settings', '/settings'],
      ['help-circle', 'more.help', '/help'],
    ];
    return a.map(([icon, label, href, tab]) => ({ id: `a:${label}`, icon, title: t(label), group: 'qa.groupActions', run: go(href, tab), hay: norm(t(label)) }));
  }, [t]);

  const results = useMemo(() => {
    const query = norm(q.trim());
    if (!query) return actions.slice(0, 7);
    const words = query.split(/\s+/);
    const match = (hay: string) => words.every((w) => hay.includes(w));
    const all: Item[] = [
      ...actions,
      ...tasks.map((x) => ({
        id: `t:${x.id}`,
        icon: (x.done ? 'check-circle' : 'circle') as IconName,
        title: x.title,
        sub: x.due ? relativeDay(x.due) : undefined,
        group: 'qa.groupTasks' as TKey,
        run: go({ pathname: '/form/task', params: { id: x.id } }),
        hay: norm(`${x.title} ${x.notes}`),
      })),
      ...events.map((x) => ({
        id: `e:${x.id}`,
        icon: 'calendar' as IconName,
        title: x.title,
        sub: `${relativeDay(x.date)}${x.allDay ? '' : ` · ${x.start}`}`,
        group: 'qa.groupEvents' as TKey,
        run: go({ pathname: '/form/event', params: { id: x.id } }),
        hay: norm(`${x.title} ${x.notes}`),
      })),
      ...reminders.map((x) => ({
        id: `r:${x.id}`,
        icon: 'bell' as IconName,
        title: x.title,
        sub: `${relativeDay(toKey(new Date(x.at)))} · ${formatClock(x.at, use24h)}`,
        group: 'qa.groupReminders' as TKey,
        run: go({ pathname: '/form/reminder', params: { id: x.id } }),
        hay: norm(x.title),
      })),
      ...goals.map((x) => ({
        id: `g:${x.id}`,
        icon: 'target' as IconName,
        title: x.title,
        sub: `${x.progress}%`,
        group: 'qa.groupGoals' as TKey,
        run: go({ pathname: '/form/goal', params: { id: x.id } }),
        hay: norm(`${x.title} ${x.why}`),
      })),
      ...ideas.map((x) => ({
        id: `i:${x.id}`,
        icon: 'zap' as IconName,
        title: x.text,
        group: 'qa.groupIdeas' as TKey,
        run: go('/lists', true),
        hay: norm(x.text),
      })),
      ...recurring.map((x) => ({
        id: `f:${x.id}`,
        icon: 'repeat' as IconName,
        title: x.note || categoryLabel(x.category),
        sub: formatMoney(x.amount, currency),
        group: 'qa.groupMoney' as TKey,
        run: go({ pathname: '/form/recurring', params: { id: x.id } }),
        hay: norm(`${x.note} ${categoryLabel(x.category)}`),
      })),
      ...txs.slice(0, 2000).map((x) => ({
        id: `x:${x.id}`,
        icon: (x.type === 'income' ? 'arrow-down-left' : 'arrow-up-right') as IconName,
        title: x.note || categoryLabel(x.category),
        sub: `${formatMoney(x.amount, currency)} · ${relativeDay(x.date)}`,
        group: 'qa.groupMoney' as TKey,
        run: go({ pathname: '/form/transaction', params: { id: x.id } }),
        hay: norm(`${x.note} ${categoryLabel(x.category)} ${x.amount}`),
      })),
    ];
    const found = all.filter((x) => match(x.hay));
    // Primero lo que empieza por la búsqueda; luego el orden por grupos.
    found.sort((a, b) => Number(b.hay.startsWith(words[0])) - Number(a.hay.startsWith(words[0])));
    return found.slice(0, 40);
  }, [q, actions, tasks, events, reminders, goals, ideas, recurring, txs, currency, use24h]);

  const parsed = useMemo(() => (q.trim().length >= 2 ? parseQuick(q) : null), [q]);
  const createItem: Item | null = parsed && (parsed.title || parsed.amount)
    ? {
        id: 'create',
        icon: KIND_ICON[parsed.kind],
        title: `${t(`qa.kind.${parsed.kind}`)}: ${parsed.title || '—'}`,
        sub: describeQuick(parsed, currency) || undefined,
        group: 'qa.groupCreate',
        hay: '',
        run: async () => {
          const ok = await runQuick(parsed);
          if (ok) {
            haptic.success();
            closePalette();
          }
        },
      }
    : null;

  // Si lo escrito coincide con algo existente, eso va primero; si no, «Crear…».
  const items = createItem ? (results.length && results[0].hay.startsWith(norm(q.trim())) ? [...results, createItem] : [createItem, ...results]) : results;

  useEffect(() => {
    setSel(0);
  }, [q]);

  const move = (d: number) => {
    setSel((s) => {
      const n = Math.max(0, Math.min(items.length - 1, s + d));
      scroll.current?.scrollTo({ y: Math.max(0, n * 52 - 160), animated: true });
      return n;
    });
  };

  if (!open) return null;

  let lastGroup = '';
  return (
    <Modal visible transparent animationType="none" onRequestClose={closePalette} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(motion.fast)} style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closePalette} accessibilityLabel={t('common.close')} />
        <View style={styles.wrap} pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.duration(motion.base).springify().damping(22)}
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: c.elevated, borderColor: c.border }]}
          >
            <View style={[styles.search, { borderBottomColor: c.border }]}>
              <Icon name="search" size={18} color={c.textMuted} />
              <TextInput
                ref={input}
                value={q}
                onChangeText={setQ}
                placeholder={t('qa.placeholder')}
                placeholderTextColor={c.textFaint}
                selectionColor={c.accent}
                autoCorrect={false}
                returnKeyType="go"
                submitBehavior="submit"
                accessibilityLabel={t('qa.placeholder')}
                onSubmitEditing={() => items[sel]?.run()}
                onKeyPress={(e) => {
                  const key = (e.nativeEvent as { key: string }).key;
                  if (key === 'ArrowDown') {
                    e.preventDefault?.();
                    move(1);
                  } else if (key === 'ArrowUp') {
                    e.preventDefault?.();
                    move(-1);
                  } else if (key === 'Escape') closePalette();
                }}
                style={[styles.input, { color: c.text }]}
              />
              {Platform.OS === 'web' ? (
                <View style={[styles.kbd, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
                  <Text variant="caption" tone="faint">
                    Esc
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView ref={scroll} style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.sm }}>
              {items.length === 0 ? (
                <Text variant="body" tone="muted" align="center" style={{ padding: space.xl }}>
                  {t('qa.nothing')}
                </Text>
              ) : (
                items.map((it, i) => {
                  const header = it.group !== lastGroup ? t(it.group) : null;
                  lastGroup = it.group;
                  const active = i === sel;
                  return (
                    <View key={it.id}>
                      {header ? (
                        <Text variant="label" tone="faint" upper style={{ paddingHorizontal: space.sm, paddingTop: i ? space.md : space.xs, paddingBottom: 4 }}>
                          {header}
                        </Text>
                      ) : null}
                      <Pressable
                        onPress={() => it.run()}
                        onHoverIn={() => setSel(i)}
                        accessibilityRole="button"
                        accessibilityLabel={it.sub ? `${it.title}, ${it.sub}` : it.title}
                        style={[styles.row, { backgroundColor: active ? c.accentSoft : 'transparent' }]}
                      >
                        <Icon name={it.icon} size={16} color={active || it.id === 'create' ? c.accent : c.textMuted} />
                        <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                          {it.title}
                        </Text>
                        {it.sub ? (
                          <Text variant="caption" tone="faint" numberOfLines={1} style={{ maxWidth: '45%' }}>
                            {it.sub}
                          </Text>
                        ) : null}
                        {active && Platform.OS === 'web' ? <Icon name="corner-down-left" size={14} color={c.textFaint} /> : null}
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: c.border }]}>
              <Text variant="caption" tone="faint" numberOfLines={2} style={{ flex: 1 }}>
                {t('qa.hint')}
              </Text>
              {Platform.OS === 'web' ? (
                <Text variant="caption" tone="faint">
                  {modKey === '⌘' ? '⌘K' : 'Ctrl+K'}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingTop: '12%', paddingHorizontal: space.lg },
  card: { width: '100%', maxWidth: 620, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, height: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, fontSize: 17, height: '100%', outlineStyle: 'none' } as object,
  kbd: { paddingHorizontal: 6, height: 22, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, height: 44, borderRadius: radius.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
