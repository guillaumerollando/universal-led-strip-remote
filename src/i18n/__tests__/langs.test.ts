import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { elkEffects } from '../../core/elk';
import { FAMILIES } from '../../core/families';
import { IR_REMOTES } from '../../core/ir';
import { LAYOUTS } from '../../core/irSetup';
import { BUILTIN_AMBIANCES } from '../../core/ambiances';
import { PRESET_SCENES } from '../../core/scenes';
import { ELK_CATALOG, LEDNET_CATALOG, MELK_CATALOG } from '../../core/effectCatalog';
import { OBK_ANIMS } from '../../core/protocols/openbeken';
import { DICTS, pickLang } from '../dicts';
import { EN } from '../langs/en';

const SRC = join(__dirname, '../..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' || f === 'core' ? [] : files(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}

/** Textes passés à `t(...)` : `t('…')` et `t(cond ? '…' : '…')`. */
function literalKeys(): string[] {
  const keys: string[] = [];
  const str = String.raw`'((?:[^'\\]|\\.)*)'`;
  for (const f of files(SRC)) {
    const code = readFileSync(f, 'utf8');
    for (const m of code.matchAll(new RegExp(String.raw`\bt(?:r)?\(\s*` + str, 'g'))) keys.push(m[1]);
    for (const m of code.matchAll(new RegExp(String.raw`\bt(?:r)?\(\s*[\w.!=<>' ]+\?\s*` + str + String.raw`\s*:\s*` + str, 'g'))) keys.push(m[1], m[2]);
  }
  return keys;
}

/** Textes venus de `src/core` et affichés tels quels : familles, effets, couleurs et effets des télécommandes. */
function dataKeys(): string[] {
  const irKeys = [...IR_REMOTES.flatMap((r) => r.keys), ...Object.values(LAYOUTS).flatMap((l) => l.keys)];
  return [
    FAMILIES['ir-nec'].label,
    'Ruban à pixels',
    ...(['elk', 'melk'] as const).flatMap((m) => elkEffects(m).map((e) => e.label)),
    ...OBK_ANIMS.map((e) => e.label),
    ...BUILTIN_AMBIANCES.map((a) => a.label),
    ...PRESET_SCENES.map((p) => p.name),
    ...[...MELK_CATALOG, ...ELK_CATALOG, ...LEDNET_CATALOG].flatMap((e) => e.parts),
    ...irKeys.filter((k) => k.kind === 'color' || k.kind === 'effect').map((k) => k.label),
  ];
}

const vars = (s: string): string => (s.match(/\{\w+\}/g) ?? []).sort().join();

describe('traduction anglaise (modèle des autres langues)', () => {
  it('trouve les textes du code', () => {
    expect(literalKeys().length).toBeGreaterThan(100);
  });

  it('traduit chaque texte affiché', () => {
    const missing = [...new Set([...literalKeys(), ...dataKeys()])].filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });

  it('garde les mêmes {variables}', () => {
    const wrong = Object.entries(EN).filter(([fr, en]) => vars(fr) !== vars(en));
    expect(wrong).toEqual([]);
  });

  it("n'a pas de traduction orpheline", () => {
    const used = new Set([...literalKeys(), ...dataKeys()]);
    expect(Object.keys(EN).filter((k) => !used.has(k))).toEqual([]);
  });
});

describe.each(Object.entries(DICTS).filter(([code]) => code !== 'fr' && code !== 'en'))('langue %s', (_code, dict) => {
  it('traduit exactement les mêmes textes que l’anglais', () => {
    const keys = Object.keys(dict!);
    expect(Object.keys(EN).filter((k) => !keys.includes(k))).toEqual([]);
    expect(keys.filter((k) => !(k in EN))).toEqual([]);
  });

  it('garde les mêmes {variables} et ne laisse rien de vide', () => {
    expect(Object.entries(dict!).filter(([fr, txt]) => !txt.trim() || vars(fr) !== vars(txt))).toEqual([]);
  });
});

describe('choix de la langue', () => {
  it('prend la première langue parlée par l’appli, anglais sinon', () => {
    expect(pickLang([{ languageCode: 'fr' }])).toBe('fr');
    expect(pickLang([{ languageCode: 'eu' }, { languageCode: 'es' }])).toBe('es');
    expect(pickLang([{ languageCode: 'eu' }])).toBe('en');
    expect(pickLang([])).toBe('en');
  });

  it('distingue chinois simplifié et traditionnel', () => {
    expect(pickLang([{ languageCode: 'zh', scriptCode: 'Hans', regionCode: 'CN' }])).toBe('zh-Hans');
    expect(pickLang([{ languageCode: 'zh', scriptCode: 'Hant' }])).toBe('zh-Hant');
    expect(pickLang([{ languageCode: 'zh', regionCode: 'TW' }])).toBe('zh-Hant');
  });

  it('comprend les anciens codes Android', () => {
    expect(pickLang([{ languageCode: 'iw' }])).toBe('he');
    expect(pickLang([{ languageCode: 'in' }])).toBe('id');
  });
});
