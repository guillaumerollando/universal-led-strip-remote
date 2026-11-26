import type { Effect, Rgb } from './types';

/**
 * Effets intégrés communs aux contrôleurs Magic Home (Wi-Fi), Zengge (Bluetooth) et Triones (HappyLighting) :
 * ils descendent de la même puce et partagent les codes 0x25 à 0x38.
 * Source : flux_led (`PresetPattern`), ha-triones. Libellés repris des effets ELK (déjà traduits).
 */
const R: Rgb = { r: 255, g: 0, b: 0 };
const G: Rgb = { r: 0, g: 255, b: 0 };
const B: Rgb = { r: 0, g: 0, b: 255 };
const W: Rgb = { r: 255, g: 255, b: 255 };
const K: Rgb = { r: 0, g: 0, b: 0 };
const RAINBOW: Rgb[] = [R, { r: 255, g: 100, b: 0 }, { r: 255, g: 220, b: 0 }, G, { r: 0, g: 230, b: 255 }, B, { r: 255, g: 0, b: 200 }];

export const LEDNET_PRESETS: Effect[] = [
  { id: 'fade7', label: 'Fondu 7 couleurs', code: 0x25, preview: RAINBOW },
  { id: 'fade-red', label: 'Respiration rouge', code: 0x26, preview: [R, { r: 40, g: 0, b: 0 }] },
  { id: 'fade-blue', label: 'Respiration bleue', code: 0x28, preview: [B, { r: 0, g: 0, b: 40 }] },
  { id: 'fade-white', label: 'Respiration blanche', code: 0x2c, preview: [W, { r: 40, g: 40, b: 40 }] },
  { id: 'fade-rg', label: 'Fondu rouge-vert', code: 0x2d, preview: [R, G] },
  { id: 'fade-rb', label: 'Fondu rouge-bleu', code: 0x2e, preview: [R, B] },
  { id: 'blink7', label: 'Clignote 7 couleurs', code: 0x30, preview: RAINBOW },
  { id: 'blink-white', label: 'Clignote blanc', code: 0x37, preview: [W, K] },
  { id: 'jump7', label: 'Saut 7 couleurs', code: 0x38, preview: RAINBOW },
];

/** Vitesse 0-100 % → délai du contrôleur (1 = le plus rapide, 31 = le plus lent). */
export const lednetDelay = (percent: number): number => Math.max(1, Math.min(31, Math.round(31 - (percent / 100) * 30)));
