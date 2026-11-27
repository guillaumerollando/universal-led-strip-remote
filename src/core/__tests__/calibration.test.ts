import { describe, expect, it } from 'vitest';

import { calibrationColor, calibrationScript, estimateLength } from '../calibration';
import { SCRIPT_MAX_BYTES } from '../creations';

describe('aide au calibrage', () => {
  it('arc-en-ciel du rouge au violet, sans revenir au rouge', () => {
    expect(calibrationColor(0)).toEqual({ r: 255, g: 0, b: 0 });
    const end = calibrationColor(1);
    expect(end.r).toBeLessThan(255);
    expect(end.b).toBe(255);
  });

  it('le script tient dans le ruban, quelle que soit la longueur annoncée', () => {
    for (const n of [60, 200, 300, 600]) expect(calibrationScript(n).join('\n').length, String(n)).toBeLessThan(SCRIPT_MAX_BYTES);
  });

  it('la couleur touchée au bout donne la longueur (ruban de Guillaume : 84 sur 200)', () => {
    expect(estimateLength(84 / 200, 200)).toBe(84);
    expect(estimateLength(1.2, 200)).toBe(200);
    expect(estimateLength(0, 200)).toBe(1);
  });
});
