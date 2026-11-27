import { getLocales } from 'expo-localization';

import { DICTS, pickLang, type Lang } from './dicts';
import { EN } from './langs/en';

/**
 * Langue de l'appli : la première langue du téléphone que l'appli parle, anglais sinon (`dicts.ts`).
 * Les textes s'écrivent en français dans le code (`t('Ajouter une lumière')`) ; `langs/*.ts` donnent leurs traductions.
 */
export const lang: Lang = pickLang(getLocales());
const dict = DICTS[lang];

/** Traduit un texte écrit en français ; `{nom}` est remplacé par `vars.nom`. Texte manquant : anglais, puis français. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  const text = dict === null ? fr : (dict[fr] ?? EN[fr] ?? fr);
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}
