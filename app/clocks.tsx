import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, EmptyState, Icon, IconButton } from '@/components/ui';
import { clockLabel } from '@/constants/cities';
import { useT } from '@/i18n/useT';
import { formatTime, splitTime } from '@/lib/date';
import { showDialog } from '@/lib/dialog';
import { haptic } from '@/lib/haptics';
import { dayRelation, dayRelationLabel, formatOffset, isNight, offsetFromLocal, zoned } from '@/lib/timezone';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Clocks() {
  const { c } = useTheme();
  const { t, lang } = useT();
  const now = useNow(true);
  const clocks = useStore((s) => s.clocks);
  const remove = useStore((s) => s.removeClock);
  const move = useStore((s) => s.moveClock);
  const use24h = useStore((s) => s.settings.use24h);
  const update = useStore((s) => s.updateClock);
  const setSettings = useStore((s) => s.setSettings);
  const primaryId = useStore((s) => s.settings.primaryClockId);
  const effectivePrimary = clocks.find((x) => x.id === primaryId)?.id ?? clocks[0]?.id;
  const [editing, setEditing] = useState(false);

  // Opciones del reloj: principal (el grande de arriba) y si se muestra en la franja superior.
  const openOptions = (id: string, name: string, pinned: boolean) => {
    haptic.tap();
    const isPrimary = id === effectivePrimary;
    showDialog(name, t('clocks.headerHint'), [
      ...(isPrimary ? [] : [{ text: t('clocks.makePrimary'), onPress: () => setSettings({ primaryClockId: id }) }]),
      ...(isPrimary ? [] : [{ text: pinned ? t('clocks.hideTop') : t('clocks.showTop'), onPress: () => update(id, { pinned: !pinned }) }]),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <Screen
      clocks={false}
      title={t('clocks.title')}
      subtitle={t('clocks.subtitle')}
      leading={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />}
      actions={
        <>
          {clocks.length > 0 && (
            <IconButton
              icon={editing ? 'check' : 'edit-2'}
              label={editing ? t('clocks.editDone') : t('common.edit')}
              variant="filled"
              onPress={() => setEditing((e) => !e)}
            />
          )}
          <IconButton icon="plus" label={t('clocks.pickerTitle')} variant="accent" onPress={() => router.push('/form/clock')} />
        </>
      }
    >
      {clocks.length === 0 ? (
        <EmptyState
          icon="globe"
          title={t('clocks.emptyTitle')}
          subtitle={t('clocks.emptyBody')}
          action={t('clocks.addCity')}
          onAction={() => router.push('/form/clock')}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" tone="muted" style={{ marginBottom: space.xs }}>
            {t('clocks.headerHint')}
          </Text>
          {clocks.map((cl, i) => {
            const name = clockLabel(cl, lang);
            const z = zoned(cl.tz, now);
            const hm = `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
            const [main, suffix] = splitTime(hm, use24h);
            const rel = dayRelation(cl.tz, now);
            const night = isNight(cl.tz, now);
            const isPrimary = cl.id === effectivePrimary;
            const onTop = isPrimary || !!cl.pinned;
            return (
              <Animated.View key={cl.id} entering={FadeInDown.delay(i * 40)} exiting={FadeOut} layout={LinearTransition.springify().damping(20)}>
                <PressableScale disabled={editing} onPress={() => openOptions(cl.id, name, !!cl.pinned)} accessibilityRole="button" accessibilityHint={t('clocks.headerHint')}>
                <Card style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, isPrimary && { borderColor: c.accent }]}>
                  {editing && (
                    <Animated.View entering={FadeIn} exiting={FadeOut}>
                      <IconButton
                        icon="minus"
                        label={t('clocks.remove', { x: name })}
                        size={32}
                        color={c.danger}
                        variant="filled"
                        onPress={() => {
                          haptic.warning();
                          remove(cl.id);
                        }}
                      />
                    </Animated.View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name={night ? 'moon' : 'sun'} size={12} color={c.textFaint} />
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {dayRelationLabel(rel)} · {formatOffset(offsetFromLocal(cl.tz, now))}
                      </Text>
                    </View>
                    <Text variant="heading" numberOfLines={1}>
                      {name}
                    </Text>
                    {onTop ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name={isPrimary ? 'star' : 'eye'} size={11} color={isPrimary ? c.accent : c.textFaint} />
                        <Text variant="caption" tone={isPrimary ? 'accent' : 'faint'}>
                          {isPrimary ? t('clocks.primary') : t('clocks.onTop')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {editing ? (
                    <View style={{ flexDirection: 'row' }}>
                      <IconButton icon="arrow-up" label={t('clocks.up')} size={34} onPress={() => move(cl.id, -1)} />
                      <IconButton icon="arrow-down" label={t('clocks.down')} size={34} onPress={() => move(cl.id, 1)} />
                    </View>
                  ) : (
                    <View style={{ alignItems: 'flex-end' }} accessible accessibilityLabel={`${name}: ${formatTime(hm, use24h)}`}>
                      <Text variant="numeric" tabular style={{ fontSize: 36, lineHeight: 40 }}>
                        {main}
                        {suffix ? (
                          <Text variant="caption" tone="muted">
                            {' '}
                            {suffix}
                          </Text>
                        ) : null}
                      </Text>
                      <Text variant="caption" tone="faint" tabular>
                        :{String(z.second).padStart(2, '0')}
                      </Text>
                    </View>
                  )}
                </Card>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
