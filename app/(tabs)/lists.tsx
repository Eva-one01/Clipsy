import { router } from 'expo-router';
import { TasksPane } from '@/components/ListPanes';
import { Screen } from '@/components/Screen';
import { IconButton } from '@/components/ui';
import { useT } from '@/i18n/useT';

/** Listas: solo las tareas. Ideas y objetivos tienen su propia sección (ideas.tsx y goals.tsx). */
export default function Lists() {
  const { t } = useT();
  return (
    <Screen
      tabbed
      title={t('lists.title')}
      subtitle={t('lists.subtitle')}
      actions={<IconButton icon="plus" label={t('common.add')} variant="accent" onPress={() => router.push('/form/task')} />}
    >
      <TasksPane />
    </Screen>
  );
}
