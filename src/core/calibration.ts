/**
 * Aide au calibrage d'un ruban à pixels : sa configuration peut annoncer plus de LED qu'il n'en a (ruban de Guillaume :
 * 200 annoncées, 84 réelles, chaque pixel allumant 3 LED). Le ruban s'allume en arc-en-ciel sur toute la longueur
 * annoncée ; l'utilisateur touche la couleur qu'il voit au bout, ce qui donne la longueur à quelques LED près, puis
 * il affine en voyant la dernière LED allumée en blanc.
 */
import { hsvToRgb } from './color';
import { stillScript } from './obkScripts';
import type { Rgb } from './protocols/types';

/** Teinte de 0 (rouge) à 300 (violet) : on s'arrête avant de revenir au rouge, pour qu'aucune couleur ne se répète. */
export const CALIBRATION_HUE_MAX = 300;
/** Paliers de couleur sur le ruban (le script reste court). */
const STEPS = 40;

/** La couleur affichée à la position `f` (0 = début, 1 = bout) de la longueur annoncée. */
export const calibrationColor = (f: number): Rgb =>
  hsvToRgb({ h: (CALIBRATION_HUE_MAX * Math.floor(Math.min(0.9999, Math.max(0, f)) * STEPS)) / STEPS, s: 1, v: 1 });

/** Le script qui allume l'arc-en-ciel de calibrage sur les `configured` LED annoncées. */
export function calibrationScript(configured: number): string[] {
  const pixels = Array.from({ length: configured }, (_, i) => calibrationColor(i / configured));
  return stillScript(pixels, { n: configured, level: 100 });
}

/** Longueur estimée quand l'utilisateur touche la couleur du bout à la position `f` (0-1) de la barre. */
export const estimateLength = (f: number, configured: number): number =>
  Math.max(1, Math.min(configured, Math.round(Math.min(1, Math.max(0, f)) * configured)));
