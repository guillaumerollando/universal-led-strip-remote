/**
 * Les blancs d'une lumière, du chaud (bougie) au froid (lumière du jour), en kelvins. Les ampoules qui ont de vraies
 * LED blanches reçoivent une commande de température ; les autres, la couleur qui s'en approche le plus.
 */
import { clamp, type Rgb } from './protocols/types';

/** Plage du curseur « chaud ↔ froid ». */
export const KELVIN_MIN = 1900;
export const KELVIN_MAX = 6500;

/** Les blancs prêts à toucher (libellés traduits à l'affichage). */
export const WHITES: { id: string; label: string; kelvin: number }[] = [
  { id: 'candle', label: 'Bougie', kelvin: 1900 },
  { id: 'warm', label: 'Chaleureux', kelvin: 2700 },
  { id: 'neutral', label: 'Neutre', kelvin: 4000 },
  { id: 'daylight', label: 'Lumière du jour', kelvin: 6000 },
];

/** Couleur d'un blanc (approximation de Tanner Helland, corps noir) : pour les lumières sans LED blanches et l'écran. */
export function kelvinToRgb(kelvin: number): Rgb {
  const t = clamp(kelvin, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
}

/** Kelvins → mireds (unité de Hue, Tasmota, Elgato), bornés à la plage de l'appareil. */
export const kelvinToMired = (kelvin: number, min = 153, max = 500): number => clamp(1_000_000 / Math.max(1, kelvin), min, max);

/** Position du curseur (0 = chaud, 1 = froid) ↔ kelvins. */
export const kelvinAt = (f: number): number => Math.round(KELVIN_MIN + (KELVIN_MAX - KELVIN_MIN) * Math.min(1, Math.max(0, f)));
export const kelvinPosition = (kelvin: number): number => Math.min(1, Math.max(0, (kelvin - KELVIN_MIN) / (KELVIN_MAX - KELVIN_MIN)));
