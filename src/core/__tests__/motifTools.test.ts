import { describe, expect, it } from 'vitest';

import { cellAtStrip, cellLeds, stripCols, fill, gradient, OFF, paintRange, rainbow, resize } from '../motifTools';

const R = { r: 255, g: 0, b: 0 };
const B = { r: 0, g: 0, b: 255 };

describe('outils de dessin de motif', () => {
  it('peint toutes les LED survolées, dans les deux sens', () => {
    expect(paintRange(fill(5, OFF), 3, 1, R)).toEqual([OFF, R, R, R, OFF]);
    expect(paintRange(fill(3, OFF), 2, 2, R)).toEqual([OFF, OFF, R]);
  });

  it('dégradé entre les deux bouts', () => {
    expect(gradient([R, OFF, B])).toEqual([R, { r: 128, g: 0, b: 128 }, B]);
  });

  it('arc-en-ciel et longueur', () => {
    expect(rainbow(3)[0]).toEqual(R);
    expect(resize([R, B], 4)).toEqual([R, B, B, B]);
    expect(resize([R, B], 0)).toEqual([R]);
  });
});

describe('toile en S (3 passages)', () => {
  it('aller, retour, aller : la case sous le doigt suit le ruban', () => {
    expect([cellLeds(84), cellLeds(200), cellLeds(40)]).toEqual([2, 4, 1]);
    const l = { width: 300, rows: 3, cols: stripCols(42), rowHeight: 30, gap: 14, inset: 37 };
    expect(l.cols).toBe(14);
    expect(cellAtStrip(38, 10, l, 42)).toBe(0); // début, en haut à gauche
    expect(cellAtStrip(262, 10, l, 42)).toBe(13); // bout du premier passage
    expect(cellAtStrip(262, 55, l, 42)).toBe(14); // le retour repart de droite
    expect(cellAtStrip(38, 55, l, 42)).toBe(27);
    expect(cellAtStrip(262, 100, l, 42)).toBe(41); // fin, en bas à droite
    expect(cellAtStrip(0, 500, l, 42)).toBe(28); // hors de la toile : bord le plus proche
  });
});
