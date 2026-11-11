import { router } from 'expo-router';
import { GoalsPane } from '@/components/ListPanes';
import { Screen } from '@/components/Screen';
import { IconButton } from '@/components/ui';
import { useT } from '@/i18n/useT';

/** Objetivos: su propia sección en la barra lateral. */
export default function Goals() {
  const { t } = useT();
  return (
    <Screen
      tabbed
      title={t('tabs.goals')}
      subtitle={t('goals.subtitle')}
      actions={<IconButton icon="plus" label={t('common.add')} variant="accent" onPress={() => router.push('/form/goal')} />}
    >
      <GoalsPane />
    </Screen>
  );
}
