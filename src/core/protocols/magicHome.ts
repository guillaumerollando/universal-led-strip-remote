/**
 * Magic Home / Zengge en Wi-Fi : TCP 5577, trames terminées par une somme de contrôle (somme des octets).
 * Source : flux_led (Home Assistant), protocoles LEDENET 8 et 9 octets. Les mêmes messages, emballés,
 * servent en Bluetooth (voir `zenggeWrap`). **À confirmer** sur un vrai contrôleur.
 */
import { lednetDelay } from './presets';
import { checksum, type Rgb } from './types';

export const MAGIC_HOME_TCP_PORT = 5577;

const withSum = (body: number[]): number[] => [...body, checksum(body)];

/** Demande d'état ; la réponse fait 14 octets et commence par 0x81. */
export const MH_QUERY = withSum([0x81, 0x8a, 0x8b]);

export const mhPower = (on: boolean): number[] => withSum([0x71, on ? 0x23 : 0x24, 0x0f]);

/**
 * Couleur. Les contrôleurs RVB+blanc (modèles 0x25, 0x35…) attendent 9 octets, les autres 8.
 * Octet de mode 0xF0 : « couleurs seulement » (on ne touche pas au blanc).
 */
export function mhColor({ r, g, b }: Rgb, nineBytes = false): number[] {
  return nineBytes ? withSum([0x31, r, g, b, 0x00, 0x00, 0xf0, 0x0f]) : withSum([0x31, r, g, b, 0x00, 0xf0, 0x0f]);
}

/** Effet intégré (codes 0x25 à 0x38) et sa vitesse. */
export const mhEffect = (code: number, speedPercent = 55): number[] => withSum([0x61, code, lednetDelay(speedPercent), 0x0f]);

/** Modèles qui prennent la couleur sur 9 octets (RVB + blanc chaud + blanc froid). */
const NINE_BYTE_MODELS = new Set([0x25, 0x35, 0x07]);
export const mhNineBytes = (modelCode: number): boolean => NINE_BYTE_MODELS.has(modelCode);

export interface MagicHomeState {
  model: number;
  on: boolean;
  rgb: Rgb;
}

/** Lit la réponse d'état (14 octets : 81, modèle, 23/24 allumé/éteint, mode, …, R, G, B, …). */
export function parseMhState(bytes: number[]): MagicHomeState | null {
  if (bytes.length < 14 || bytes[0] !== 0x81) return null;
  if (checksum(bytes.slice(0, 13)) !== bytes[13]) return null;
  return { model: bytes[1], on: bytes[2] === 0x23, rgb: { r: bytes[6], g: bytes[7], b: bytes[8] } };
}

