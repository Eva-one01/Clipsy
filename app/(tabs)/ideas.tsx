import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { IdeasPane } from '@/components/ListPanes';
import { Screen } from '@/components/Screen';
import { IconButton } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useStore } from '@/store';

/** Ideas: su propia sección en la barra lateral. */
export default function Ideas() {
  const { t } = useT();
  const ref = useRef<TextInput>(null);
  const addIdea = useStore((s) => s.addIdea);
  // El borrador vive aquí para que el botón + pueda guardarlo.
  const [draft, setDraft] = useState('');
  const save = () => {
    if (!draft.trim()) return false;
    addIdea(draft.trim());
    setDraft('');
    return true;
  };
  return (
    <Screen
      tabbed
      title={t('tabs.ideas')}
      subtitle={t('ideas.subtitle')}
      actions={<IconButton icon="plus" label={t('common.add')} variant="accent" onPress={() => save() || ref.current?.focus()} />}
    >
      <IdeasPane inputRef={ref} draft={draft} setDraft={setDraft} save={save} />
    </Screen>
  );
}
