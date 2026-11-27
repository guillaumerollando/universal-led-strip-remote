import { describe, expect, it } from 'vitest';

import { BUILTIN_AMBIANCES } from '../ambiances';
import { MIN_DELAY_MS, motifScript, snakeScript, stepScript } from '../obkScripts';

const ctx = { n: 200, level: 100 };
const scripts = (n: number): [string, string[]][] => [
  ...BUILTIN_AMBIANCES.map((a) => [a.id, a.build!({ n, level: 70 })] as [string, string[]]),
  ...(['snake', 'flow', 'still'] as const).map((mode) => {
    const pixels = Array.from({ length: 20 }, (_, i) => ({ r: i * 12, g: 255 - i * 12, b: 100 }));
    return [`motif ${mode}`, motifScript({ mode, pixels }, { n, level: 100 }, 100)] as [string, string[]];
  }),
];

describe('scripts du ruban : les règles apprises sur le vrai ruban', () => {
  it.each([200, 255, 60])('%i LED : un seul fichier court, pas de pause trop courte, lignes courtes', (n) => {
    for (const [name, lines] of scripts(n)) {
      const text = lines.join('\n') + '\n';
      // Un seul fichier : le ruban accepte ~6 Ko d'un bloc ; on garde de la marge.
      expect(text.length, name).toBeLessThan(5000);
      // `delay_ms 0` (ou trop court) gèle le ruban : chien de garde, mode sécurité.
      for (const m of text.matchAll(/delay_ms (\d+)/g)) expect(Number(m[1]), name).toBeGreaterThanOrEqual(MIN_DELAY_MS);
      // Une ligne de commande OpenBeken fait au plus 512 caractères.
      expect(Math.max(...lines.map((l) => l.length)), name).toBeLessThan(512);
      // Toujours couper l'animation intégrée (sinon elle redessine par-dessus).
      expect(lines[0], name).toBe('Anim -1');
      // Jamais le hasard brut (positions qui se répètent) : toujours `$rand01`.
      expect(text, name).not.toMatch(/\$rand(?!01)/);
      // Tout « goto » vise une étiquette du fichier.
      for (const m of text.matchAll(/goto (\w+)/g)) expect(lines, `${name} → ${m[1]}`).toContain(`${m[1]}:`);
    }
  });

  it('le serpent validé : il éteint la LED derrière lui puis se dessine', () => {
    const lines = snakeScript([{ r: 255, g: 0, b: 0 }], ctx, 40);
    expect(lines).toEqual([
      'Anim -1',
      'SM16703P_SetPixel all 0 0 0',
      'setChannel 30 0',
      'again:',
      'SM16703P_SetPixel (($CH30+199)%200) 0 0 0',
      'SM16703P_SetPixel (($CH30+0)%200) 255 0 0',
      'SM16703P_Start',
      'addChannel 30 1 0 199 1',
      'delay_ms 40',
      'goto again',
    ]);
  });

  it('guirlande qui avance : tout le ruban redessiné par boucles, une par couleur', () => {
    const lines = stepScript([{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }], ctx, 700);
    expect(lines).toContain('SM16703P_SetPixel (($CH34+$CH30)%200) 255 0 0');
    expect(lines).toContain('if $CH34<200 then goto g0');
    expect(lines).toContain('addChannel 30 1 0 1 1');
    expect(lines).toContain('delay_ms 700');
  });

  it('la luminosité est appliquée aux couleurs', () => {
    expect(snakeScript([{ r: 200, g: 100, b: 0 }], { n: 10, level: 50 }, 40)).toContain('SM16703P_SetPixel (($CH30+0)%10) 100 50 0');
  });

  it('motif fixe : dessiné une fois, sans boucle sans fin', () => {
    const lines = motifScript({ mode: 'still', pixels: [{ r: 1, g: 2, b: 3 }] }, ctx, 50);
    expect(lines).not.toContain('goto again');
    expect(lines[lines.length - 1]).toBe('SM16703P_Start');
  });
});
