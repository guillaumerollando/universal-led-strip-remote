import type { Rgb } from './elk';

/** Teinte 0-360, saturation et valeur 0-1. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rr) h = 60 * (((gg - bb) / d) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / d + 2);
    else h = 60 * ((rr - gg) / d + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

/**
 * Curseur « Blancheur » (0 = couleur pure, 1 = blanc) → saturation. Sur des LED, un tout petit peu de blanc se voit
 * énormément (Guillaume, 2026-11-27 : « dès qu'on la touche un peu, ça fait tout de suite très blanc ») : la courbe
 * monte doucement au début pour laisser des nuances (pastels), et ne devient blanche que vers la fin.
 */
const WHITE_CURVE = 2.6;
export const whiteToSaturation = (white: number): number => 1 - Math.min(1, Math.max(0, white)) ** WHITE_CURVE;
export const saturationToWhite = (s: number): number => (1 - Math.min(1, Math.max(0, s))) ** (1 / WHITE_CURVE);

/** Couleurs du curseur « Blancheur » le long de la courbe (le dégradé montre ce que le ruban fera). */
export const whiteStops = (h: number, v = 1, steps = 6): string[] =>
  Array.from({ length: steps }, (_, i) => {
    const c = hsvToRgb({ h, s: whiteToSaturation(i / (steps - 1)), v });
    return `rgb(${c.r},${c.g},${c.b})`;
  });
