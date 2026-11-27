import { describe, expect, it } from 'vitest';
import { hsvToRgb, rgbToHsv } from '../color';
import { saturationToWhite, whiteToSaturation } from '../color';

describe('couleurs', () => {
  it('convertit les teintes principales', () => {
    expect(hsvToRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
    expect(hsvToRgb({ h: 200, s: 0, v: 1 })).toEqual({ r: 255, g: 255, b: 255 });
    expect(hsvToRgb({ h: 360, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('fait l’aller-retour', () => {
    for (const rgb of [{ r: 255, g: 0, b: 140 }, { r: 0, g: 200, b: 255 }, { r: 255, g: 196, b: 120 }]) {
      expect(hsvToRgb(rgbToHsv(rgb))).toEqual(rgb);
    }
  });
});

describe('curseur « Blancheur »', () => {
  it('reste coloré au début, blanc seulement au bout, et se relit', () => {
    expect(whiteToSaturation(0)).toBe(1);
    expect(whiteToSaturation(1)).toBe(0);
    // À un tiers du curseur, la couleur est encore presque pure (rouge → 255, 15, 15 environ).
    expect(whiteToSaturation(1 / 3)).toBeGreaterThan(0.93);
    expect(saturationToWhite(whiteToSaturation(0.6))).toBeCloseTo(0.6, 6);
  });
});
