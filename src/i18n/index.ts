import { getLocales } from 'expo-localization';
import de from './locales/de';
import en from './locales/en';
import es, { type Dict, type TKey } from './locales/es';
import fr from './locales/fr';
import pt from './locales/pt';
import ru from './locales/ru';

export type Lang = 'es' | 'en' | 'pt' | 'fr' | 'ru' | 'de';
export type { TKey };

/** Nombre de cada idioma escrito en su propio idioma (así se reconoce siempre). */
export const languages: { code: Lang; native: string }[] = [
  { code: 'es', native: 'Español' },
  { code: 'en', native: 'English' },
  { code: 'pt', native: 'Português' },
  { code: 'fr', native: 'Français' },
  { code: 'ru', native: 'Русский' },
  { code: 'de', native: 'Deutsch' },
];

const dicts: Record<Lang, Dict> = { es, en, pt, fr, ru, de };

/** Etiqueta BCP-47 base para Intl (fechas, números). */
const intlBase: Record<Lang, string> = { es: 'es', en: 'en', pt: 'pt-BR', fr: 'fr', ru: 'ru', de: 'de' };

let current: Lang = detectLanguage();

export function detectLanguage(): Lang {
  try {
    const code = getLocales()[0]?.languageCode as Lang | undefined;
    return code && code in dicts ? code : 'en';
  } catch {
    return 'en';
  }
}

export function setLanguage(lang: Lang) {
  if (lang in dicts) current = lang;
}

export function getLanguage(): Lang {
  return current;
}

/**
 * Locale para Intl: idioma elegido + región del dispositivo cuando existe
 * (p. ej. es-CO, en-GB), para respetar formatos locales de fecha y moneda.
 */
export function intlLocale(lang: Lang = current): string {
  try {
    const region = getLocales()[0]?.regionCode;
    const base = intlBase[lang].split('-')[0];
    return region ? `${base}-${region}` : intlBase[lang];
  } catch {
    return intlBase[lang];
  }
}

export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: TKey, params?: Params): string {
  let s = dicts[lang][key] ?? es[key] ?? key;
  if (params) for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  return s;
}

/** Traducción fuera de componentes (notificaciones, utilidades). */
export function t(key: TKey, params?: Params): string {
  return translate(current, key, params);
}
