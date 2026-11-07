import { useCallback } from 'react';
import { useStore } from '@/store';
import { translate, type Params, type TKey } from './index';

/** Hook de traducción: re-renderiza el componente cuando cambia el idioma. */
export function useT() {
  const lang = useStore((s) => s.settings.language);
  const t = useCallback((key: TKey, params?: Params) => translate(lang, key, params), [lang]);
  return { t, lang };
}
