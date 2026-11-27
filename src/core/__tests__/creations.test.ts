import { describe, expect, it } from 'vitest';

import { BUILTIN_AMBIANCES } from '../ambiances';
import { CELLS, creationScript, DEFAULTS, LIMITS, SCRIPT_MAX_BYTES, snakeOf, toFullStrip, type Creation, type CreationStyle } from '../creations';
import { fill, gradient, OFF, paintRange, rainbow as rainbowSteps } from '../motifTools';
import { previewFrame } from '../creationPreview';
import { MIN_DELAY_MS } from '../obkScripts';

const STYLES: CreationStyle[] = ['motif', 'bands', 'glows', 'step', 'flicker', 'leaves'];
const rainbow = (k: number) => Array.from({ length: k }, (_, i) => ({ r: (i * 53) % 256, g: (i * 97) % 256, b: (i * 151) % 256 }));

/** Toutes les créations à vérifier : les modèles des ambiances, et chaque style au maximum de ses couleurs. */
function cases(): [string, Creation][] {
  const out: [string, Creation][] = BUILTIN_AMBIANCES.filter((a) => a.template).map((a) => [
    `modèle ${a.id}`,
    { ...DEFAULTS, ...a.template!, mode: a.template!.mode ?? 'flow', cell: a.template!.cell ?? 1 },
  ]);
  for (const style of STYLES) {
    for (const size of ['small', 'medium', 'large'] as const) {
      out.push([`${style} ${size}`, { ...DEFAULTS, style, size, colors: rainbow(Math.min(200, LIMITS[style].max)), speed: 100 }]);
    }
  }
  for (const mode of ['snake', 'flow', 'still'] as const) {
    for (const cell of CELLS) out.push([`motif ${mode} ×${cell}`, { ...DEFAULTS, style: 'motif', mode, cell, colors: rainbow(10), speed: 100 }]);
  }
  return out;
}

describe('créations : toutes respectent les règles du ruban', () => {
  it.each([60, 200, 255])('%i LED', (n) => {
    for (const [name, c] of cases()) {
      const lines = creationScript(c, { n, level: 80 });
      const text = lines.join('\n');
      // Les dessins très détaillés peuvent dépasser : l'éditeur le signale et bloque l'envoi ; pas les modèles.
      if (name.startsWith('modèle')) expect(text.length, name).toBeLessThan(SCRIPT_MAX_BYTES);
      for (const m of text.matchAll(/delay_ms (\d+)/g)) expect(Number(m[1]), name).toBeGreaterThanOrEqual(MIN_DELAY_MS);
      expect(Math.max(...lines.map((l) => l.length)), name).toBeLessThan(512);
      for (const m of text.matchAll(/goto (\w+)/g)) expect(lines, `${name} → ${m[1]}`).toContain(`${m[1]}:`);
      expect(lines[0], name).toBe('Anim -1');
    }
  });

  it('un motif à grandes cases couvre tout le ruban en une boucle par série de même couleur', () => {
    const lines = creationScript({ ...DEFAULTS, style: 'motif', mode: 'still', cell: 10, colors: rainbow(2) }, { n: 200, level: 100 });
    expect(lines.filter((l) => l.startsWith('SM16703P_SetPixel'))).toHaveLength(2);
    expect(lines).toContain('if $CH35<10 then goto g0s');
  });

  it('un serpent reste court (40 LED au plus)', () => {
    const lines = creationScript({ ...DEFAULTS, style: 'motif', mode: 'snake', cell: 10, colors: rainbow(8) }, { n: 200, level: 100 });
    expect(lines.filter((l) => l.startsWith('SM16703P_SetPixel (($CH30')).length).toBeLessThanOrEqual(41);
  });

  it('l’aperçu donne une rangée complète pour chaque style', () => {
    for (const style of STYLES) {
      for (const frame of [0, 7, 33]) expect(previewFrame({ ...DEFAULTS, style }, frame, 40)).toHaveLength(40);
    }
  });

  it('le motif couvre tout le ruban, en 60 cases au plus (anciens dessins redécoupés)', () => {
    const small: Creation = { ...DEFAULTS, style: 'motif', mode: 'flow', cell: 5, colors: rainbow(4) };
    const full = toFullStrip(small, 200);
    expect([full.cell, full.colors.length]).toEqual([4, 50]);
    expect(full.colors[5]).toEqual(rainbow(4)[0]); // LED 20 : le motif de 20 LED recommence
    const short = toFullStrip(small, 84);
    expect([short.cell, short.colors.length]).toEqual([2, 42]);
    expect(toFullStrip({ ...small, mode: 'snake' }, 200).colors[10]).toEqual(OFF);
    expect(toFullStrip(full, 200)).toBe(full);
    // Le script dessine bien les 84 LED, dans l'ordre.
    const lines = creationScript({ ...short, mode: 'still' }, { n: 84, level: 100 });
    expect(lines.join('\n')).not.toMatch(/SM16703P_SetPixel (8[4-9]|9\d|1\d\d) /);
  });

  it('serpent d’un dessin plein ruban : sa partie allumée, 40 LED au plus', () => {
    const drawing = paintRange(fill(200, OFF), 50, 57, { r: 255, g: 0, b: 0 });
    expect(snakeOf(drawing)).toHaveLength(8);
    expect(snakeOf(paintRange(fill(200, OFF), 0, 120, { r: 0, g: 0, b: 255 }))).toHaveLength(40);
  });

  it('un arc-en-ciel ou un dégradé sur 200 LED tient dans le ruban, dans les trois animations', () => {
    const ends = paintRange(paintRange(fill(200, OFF), 0, 0, { r: 255, g: 0, b: 0 }), 199, 199, { r: 0, g: 0, b: 255 });
    for (const colors of [rainbowSteps(200, 40), gradient(ends, 40)]) {
      for (const mode of ['still', 'flow', 'snake'] as const) {
        const text = creationScript({ ...DEFAULTS, style: 'motif', mode, cell: 1, colors }, { n: 200, level: 100 }).join('\n');
        expect(text.length, mode).toBeLessThan(SCRIPT_MAX_BYTES);
      }
    }
  });

  it('un dessin plein ruban : fond d’un coup, puis seulement les autres couleurs', () => {
    const drawing = paintRange(fill(200, OFF), 10, 19, { r: 0, g: 255, b: 0 });
    const lines = creationScript({ ...DEFAULTS, style: 'motif', mode: 'still', cell: 1, colors: drawing }, { n: 200, level: 100 });
    expect(lines).toContain('SM16703P_SetPixel all 0 0 0');
    expect(lines).toContain('if $CH34<20 then goto g10');
    expect(lines.filter((l) => l.startsWith('SM16703P_SetPixel'))).toHaveLength(2);
  });

  it('l’aperçu d’un dessin montre tout le ruban, LED pour LED (cases de 2 sur 84 LED)', () => {
    const c = toFullStrip({ ...DEFAULTS, style: 'motif', mode: 'still', cell: 1, colors: rainbow(84) }, 84);
    const frame = previewFrame(c, 0, 84);
    expect(frame).toHaveLength(84);
    expect(frame[83]).toEqual(c.colors[41]);
    expect(frame[1]).toEqual(c.colors[0]);
  });
});
