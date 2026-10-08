import { EN } from './langs/en';
import { ES } from './langs/es';
import { PT } from './langs/pt';
import { DE } from './langs/de';
import { IT } from './langs/it';
import { NL } from './langs/nl';
import { PL } from './langs/pl';
import { RU } from './langs/ru';
import { UK } from './langs/uk';
import { TR } from './langs/tr';
import { AR } from './langs/ar';
import { HE } from './langs/he';
import { HI } from './langs/hi';
import { ID } from './langs/id';
import { VI } from './langs/vi';
import { TH } from './langs/th';
import { JA } from './langs/ja';
import { KO } from './langs/ko';
import { ZH_HANS } from './langs/zh-Hans';
import { ZH_HANT } from './langs/zh-Hant';
import { SV } from './langs/sv';
import { CS } from './langs/cs';
import { RO } from './langs/ro';
import { HU } from './langs/hu';
import { EL } from './langs/el';

/**
 * Langues de l'appli. Le français est la langue du code (pas de dictionnaire) ; toutes les autres traduisent `en.ts`,
 * clé pour clé. Ajouter une langue : un fichier dans `langs/`, une ligne ici, et `locales/<code>.json` pour le nom sous l'icône.
 */
export const DICTS = {
  fr: null,
  en: EN,
  'es': ES,
  'pt': PT,
  'de': DE,
  'it': IT,
  'nl': NL,
  'pl': PL,
  'ru': RU,
  'uk': UK,
  'tr': TR,
  'ar': AR,
  'he': HE,
  'hi': HI,
  'id': ID,
  'vi': VI,
  'th': TH,
  'ja': JA,
  'ko': KO,
  'zh-Hans': ZH_HANS,
  'zh-Hant': ZH_HANT,
  'sv': SV,
  'cs': CS,
  'ro': RO,
  'hu': HU,
  'el': EL,
} satisfies Record<string, Record<string, string> | null>;

export type Lang = keyof typeof DICTS;

/** Anciens codes de langue encore renvoyés par certains Android. */
const LEGACY: Record<string, string> = { iw: 'he', in: 'id', ji: 'yi' };

interface LocaleLike {
  languageCode?: string | null;
  scriptCode?: string | null;
  regionCode?: string | null;
}

/** Première langue du téléphone que l'appli parle (dans l'ordre de préférence de l'utilisateur), anglais sinon. */
export function pickLang(locales: readonly LocaleLike[]): Lang {
  for (const l of locales) {
    const raw = (l.languageCode ?? '').toLowerCase();
    const code = LEGACY[raw] ?? raw;
    if (code === 'zh') {
      const hant = l.scriptCode === 'Hant' || (!l.scriptCode && ['TW', 'HK', 'MO'].includes(l.regionCode ?? ''));
      return hant ? 'zh-Hant' : 'zh-Hans';
    }
    if (code in DICTS) return code as Lang;
  }
  return 'en';
}
