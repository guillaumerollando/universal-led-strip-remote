import { getLocales } from 'expo-localization';

import { EN } from './en';

/**
 * Langue de l'appli, d'après celle du téléphone : français si le téléphone est en français, anglais sinon.
 * Les textes s'écrivent en français dans le code (`t('Ajouter un ruban')`) ; `en.ts` donne leur traduction.
 */
export const lang: 'fr' | 'en' = getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en';

/** Traduit un texte écrit en français ; `{nom}` est remplacé par `vars.nom`. Sans traduction, le texte reste tel quel. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  const text = lang === 'fr' ? fr : (EN[fr] ?? fr);
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}
