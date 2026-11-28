/**
 * Outils du dessin de motif (purs, testés) : peindre en glissant le doigt, remplir, dégradé, arc-en-ciel, longueur.
 */
import { hsvToRgb } from './color';
import type { Rgb } from './protocols/types';

export const OFF: Rgb = { r: 0, g: 0, b: 0 };
export const sameRgb = (a: Rgb, b: Rgb): boolean => a.r === b.r && a.g === b.g && a.b === b.b;

/** Peint les LED de `from` à `to` (inclus, dans un sens ou l'autre) : un glissement rapide ne saute aucune LED. */
export function paintRange(pixels: Rgb[], from: number, to: number, color: Rgb): Rgb[] {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return pixels.map((p, i) => (i >= a && i <= b ? color : p));
}

export const fill = (count: number, color: Rgb): Rgb[] => Array.from({ length: count }, () => color);

/** Dégradé entre la première et la dernière LED (on peint les deux bouts, puis « Dégradé »). */
export function gradient(pixels: Rgb[], steps = pixels.length): Rgb[] {
  const n = pixels.length;
  if (n < 3) return pixels;
  const a = pixels[0];
  const b = pixels[n - 1];
  const mix = (x: number, y: number, k: number): number => Math.round(x + (y - x) * k);
  const s = Math.max(2, Math.min(steps, n));
  return pixels.map((_, i) => {
    // Par paliers : `s` couleurs, de la première à la dernière LED.
    const k = Math.min(s - 1, Math.floor((i * s) / n)) / (s - 1);
    return { r: mix(a.r, b.r, k), g: mix(a.g, b.g, k), b: mix(a.b, b.b, k) };
  });
}

/** Arc-en-ciel en `steps` paliers au plus (sur tout le ruban, 40 paliers suffisent à l'œil et gardent le script court). */
export const rainbow = (count: number, steps = count): Rgb[] =>
  Array.from({ length: count }, (_, i) => hsvToRgb({ h: (360 * Math.floor((i * steps) / count)) / steps, s: 1, v: 1 }));

/** Change la longueur : les nouvelles LED prennent la couleur de la dernière. */
export function resize(pixels: Rgb[], count: number): Rgb[] {
  if (count <= pixels.length) return pixels.slice(0, Math.max(1, count));
  const last = pixels[pixels.length - 1] ?? OFF;
  return [...pixels, ...Array.from({ length: count - pixels.length }, () => last)];
}

/** Le ruban se dessine plié en S, en 3 passages : aller, retour, aller (souhait de Guillaume, 2026-11-27). */
export const STRIP_ROWS = 3;
/** Au plus 60 cases à peindre : au-delà, chaque case couvre plusieurs LED (« on n'est pas à une LED près »). */
const MAX_CELLS = 60;
/** LED couvertes par une case, pour un ruban de `n` LED. */
export const cellLeds = (n: number): number => Math.max(1, Math.ceil(n / MAX_CELLS));
/** Cases par passage du S. */
export const stripCols = (cells: number): number => Math.max(1, Math.ceil(cells / STRIP_ROWS));

/** Géométrie de la toile en S : largeur, passages, cases par passage, hauteur d'un passage, écart, marge des virages. */
export interface StripLayout {
  width: number;
  rows: number;
  cols: number;
  rowHeight: number;
  gap: number;
  inset: number;
}

/**
 * Case sous le doigt sur la toile en S (`x`, `y` depuis le coin de la toile) : passage le plus proche, puis case dans
 * le sens du passage (aller de gauche à droite, retour de droite à gauche). `null` hors des cases.
 */
export function cellAtStrip(x: number, y: number, l: StripLayout, count: number): number | null {
  if (count <= 0 || l.width <= 2 * l.inset) return null;
  const row = Math.max(0, Math.min(l.rows - 1, Math.floor((y + l.gap / 2) / (l.rowHeight + l.gap))));
  const col = Math.max(0, Math.min(l.cols - 1, Math.floor(((x - l.inset) / (l.width - 2 * l.inset)) * l.cols)));
  const i = row * l.cols + (row % 2 === 0 ? col : l.cols - 1 - col);
  return i < count ? i : count - 1;
}
