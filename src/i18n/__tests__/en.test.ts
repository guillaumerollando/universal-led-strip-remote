import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { elkEffects } from '../../core/elk';
import { FAMILIES } from '../../core/families';
import { IR_REMOTES } from '../../core/ir';
import { LAYOUTS } from '../../core/irSetup';
import { EN } from '../en';

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
    ...(['elk', 'melk'] as const).flatMap((m) => elkEffects(m).map((e) => e.label)),
    ...irKeys.filter((k) => k.kind === 'color' || k.kind === 'effect').map((k) => k.label),
  ];
}

describe('traduction anglaise', () => {
  it('trouve les textes du code', () => {
    expect(literalKeys().length).toBeGreaterThan(100);
  });

  it('traduit chaque texte affiché', () => {
    const missing = [...new Set([...literalKeys(), ...dataKeys()])].filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });

  it('garde les mêmes {variables}', () => {
    const vars = (s: string): string => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const wrong = Object.entries(EN).filter(([fr, en]) => vars(fr) !== vars(en));
    expect(wrong).toEqual([]);
  });

  it("n'a pas de traduction orpheline", () => {
    const used = new Set([...literalKeys(), ...dataKeys()]);
    expect(Object.keys(EN).filter((k) => !used.has(k))).toEqual([]);
  });
});
