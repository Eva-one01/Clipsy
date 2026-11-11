/** Tareas, ideas y objetivos: cada uno tiene su sección en la barra lateral (app/(tabs)/lists, ideas y goals). */
import { router } from 'expo-router';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Input } from './Input';
import { PressableScale } from './PressableScale';
import { TaskRow } from './rows';
import { Text } from './Text';
import { Card, Chip, EmptyState, Icon, IconButton, ProgressBar, SectionHeader } from './ui';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { diffDays, formatShortDate, relativeDay, todayKey } from '@/lib/date';
import { showDialog } from '@/lib/dialog';
import { useStore } from '@/store';
import type { Goal, Idea, Task } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

/* ───────────── Tareas ───────────── */

export function TasksPane() {
  const { t } = useT();
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const clearDone = useStore((s) => s.clearDoneTasks);
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const [draft, setDraft] = useState('');

  const groups = useMemo(() => {
    const today = todayKey();
    const open = tasks.filter((x) => !x.done);
    const byPriority = (a: Task, b: Task) => b.priority - a.priority || (a.due ?? '9').localeCompare(b.due ?? '9');
    return [
      { id: 'overdue', title: 'lists.g.overdue' as TKey, items: open.filter((x) => x.due && diffDays(x.due, today) < 0).sort(byPriority) },
      { id: 'today', title: 'lists.g.today' as TKey, items: open.filter((x) => x.due === today).sort(byPriority) },
      { id: 'upcoming', title: 'lists.g.upcoming' as TKey, items: open.filter((x) => x.due && diffDays(x.due, today) > 0).sort(byPriority) },
      { id: 'nodue', title: 'lists.g.noDue' as TKey, items: open.filter((x) => !x.due).sort(byPriority) },
    ].filter((g) => g.items.length);
  }, [tasks]);

  const done = useMemo(() => tasks.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)), [tasks]);

  return (
    <View>
      <Input
        placeholder={t('lists.newTask')}
        value={draft}
        onChangeText={setDraft}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={() => {
          if (!draft.trim()) return;
          addTask({ title: draft });
          setDraft('');
        }}
        hint={t('lists.taskHint')}
      />
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        <Chip label={t('lists.pending', { n: tasks.length - done.length })} selected={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label={t('lists.doneTab', { n: done.length })} selected={filter === 'done'} onPress={() => setFilter('done')} />
      </View>

      {filter === 'open' ? (
        groups.length === 0 ? (
          <EmptyState icon="check-circle" title={t('lists.allDoneTitle')} subtitle={t('lists.allDoneBody')} />
        ) : (
          groups.map((g) => (
            <View key={g.id}>
              <SectionHeader title={`${t(g.title)} · ${g.items.length}`} />
              {g.items.map((x, i) => (
                <TaskRow key={x.id} task={x} index={i} showDue={g.id !== 'today'} />
              ))}
            </View>
          ))
        )
      ) : done.length === 0 ? (
        <EmptyState icon="archive" title={t('lists.noneDoneTitle')} subtitle={t('lists.noneDoneBody')} />
      ) : (
        <>
          <SectionHeader
            title={t('lists.completed')}
            action={t('lists.clear')}
            onAction={() =>
              showDialog(t('lists.clearTitle'), t('lists.clearBody', { n: done.length }), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: () => clearDone() },
              ])
            }
          />
          {done.map((x, i) => (
            <TaskRow key={x.id} task={x} index={i} />
          ))}
        </>
      )}
    </View>
  );
}

/* ───────────── Ideas ───────────── */

export function IdeasPane({ inputRef, draft, setDraft, save }: { inputRef: RefObject<TextInput | null>; draft: string; setDraft: (v: string) => void; save: () => boolean }) {
  const { t } = useT();
  const ideas = useStore((s) => s.ideas);
  const sorted = useMemo(() => [...ideas].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt), [ideas]);

  return (
    <View>
      <Input
        ref={inputRef}
        placeholder={t('lists.ideaPlaceholder')}
        value={draft}
        onChangeText={setDraft}
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top' }}
        returnKeyType="done"
        // Intro guarda la idea; Mayús + Intro hace un salto de línea.
        onKeyPress={(e) => {
          const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean; preventDefault?: () => void };
          if (ev.key === 'Enter' && !ev.shiftKey) {
            (e as unknown as { preventDefault?: () => void }).preventDefault?.();
            save();
          }
        }}
        hint={t('lists.ideaHint')}
      />
      {sorted.length === 0 ? (
        <EmptyState icon="feather" title={t('lists.ideasEmptyTitle')} subtitle={t('lists.ideasEmptyBody')} />
      ) : (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {sorted.map((idea, i) => (
            <IdeaCard key={idea.id} idea={idea} index={i} />
          ))}
        </View>
      )}
    </View>
  );
}

function IdeaCard({ idea, index }: { idea: Idea; index: number }) {
  const { c } = useTheme();
  const { t } = useT();
  const togglePin = useStore((s) => s.togglePinIdea);
  const del = useStore((s) => s.deleteIdea);
  const addTask = useStore((s) => s.addTask);

  const menu = () => {
    showDialog(t('lists.idea'), idea.text.slice(0, 80), [
      { text: idea.pinned ? t('lists.unpin') : t('lists.pin'), onPress: () => togglePin(idea.id) },
      {
        text: t('lists.toTask'),
        onPress: () => {
          addTask({ title: idea.text.split('\n')[0].slice(0, 120) });
          del(idea.id);
        },
      },
      { text: t('common.delete'), style: 'destructive', onPress: () => del(idea.id) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30)} exiting={FadeOut} layout={LinearTransition.springify().damping(20)}>
      <PressableScale onLongPress={menu} onPress={menu} scaleTo={0.985} accessibilityLabel={`${t('lists.idea')}: ${idea.text}`} accessibilityHint={t('lists.openOptions')}>
        <Card style={{ gap: space.sm, borderColor: idea.pinned ? c.accent : c.border }}>
          <Text variant="body">{idea.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {idea.pinned && <Icon name="bookmark" size={12} color={c.accent} />}
            <Text variant="caption" tone="faint">
              {formatShortDate(new Date(idea.createdAt))}
            </Text>
          </View>
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

/* ───────────── Objetivos ───────────── */

export function GoalsPane() {
  const { t } = useT();
  const goals = useStore((s) => s.goals);
  const active = goals.filter((g) => !g.archived && g.progress < 100);
  const completed = goals.filter((g) => !g.archived && g.progress >= 100);

  if (goals.length === 0) {
    return (
      <EmptyState
        icon="target"
        title={t('lists.goalsEmptyTitle')}
        subtitle={t('lists.goalsEmptyBody')}
        action={t('lists.createGoal')}
        onAction={() => router.push('/form/goal')}
      />
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {active.map((g, i) => (
        <GoalCard key={g.id} goal={g} index={i} />
      ))}
      {completed.length > 0 && (
        <>
          <SectionHeader title={t('lists.achieved', { n: completed.length })} />
          {completed.map((g, i) => (
            <GoalCard key={g.id} goal={g} index={i} />
          ))}
        </>
      )}
    </View>
  );
}

function GoalCard({ goal, index }: { goal: Goal; index: number }) {
  const { c } = useTheme();
  const { t } = useT();
  const update = useStore((s) => s.updateGoal);
  const tasks = useStore((s) => s.tasks);
  const linked = useMemo(() => tasks.filter((x) => x.goalId === goal.id), [tasks, goal.id]);
  const openCount = linked.filter((x) => !x.done).length;
  const done = goal.progress >= 100;

  const step = (d: number) => {
    const next = Math.max(0, Math.min(100, goal.progress + d));
    update(goal.id, { progress: next });
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 40)} layout={LinearTransition.springify().damping(20)}>
      <PressableScale scaleTo={0.985} onPress={() => router.push({ pathname: '/form/goal', params: { id: goal.id } })} accessibilityLabel={`${goal.title}, ${goal.progress}%`}>
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: goal.color }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading" numberOfLines={2} style={done ? { color: c.textMuted } : undefined}>
                {goal.title}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {[
                  goal.deadline
                    ? diffDays(goal.deadline, todayKey()) < 0 && !done
                      ? t('lists.goalOverdue', { d: relativeDay(goal.deadline) })
                      : t('lists.goalDue', { d: relativeDay(goal.deadline) })
                    : null,
                  linked.length ? t('lists.openTasks', { n: openCount }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || goal.why || t('lists.noDeadline')}
              </Text>
            </View>
            <Text variant="title" tabular style={{ fontWeight: '300' }}>
              {goal.progress}
              <Text variant="caption" tone="muted">
                %
              </Text>
            </Text>
          </View>
          <ProgressBar value={goal.progress / 100} color={done ? c.success : goal.color} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
            <StepButton label="−10" onPress={() => step(-10)} />
            <StepButton label="+10" onPress={() => step(10)} />
          </View>
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  const { t } = useT();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={t('lists.progress', { x: label })} scaleTo={0.9} style={{ paddingHorizontal: space.md, height: 32, borderRadius: radius.sm, backgroundColor: c.surfaceAlt, justifyContent: 'center' }}>
      <Text variant="caption" tabular style={{ fontWeight: '600' }}>
        {label}
      </Text>
    </PressableScale>
  );
}
