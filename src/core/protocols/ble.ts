/**
 * Contrôleurs Bluetooth à protocole documenté par la communauté (hors ELK-BLEDOM, voir `elk.ts`).
 * Tout est **à confirmer** sur un vrai appareil (sources : intégrations Home Assistant et projets open source).
 */
import { rgbToHsv } from '../color';
import { lednetDelay } from './presets';
import { checksum, clamp, uuid16, type BleProfile, type Rgb } from './types';
import { kelvinToMired } from '../white';

// ── Triones / HappyLighting (noms Triones, QHM-, LEDBlue, Dream~, Flash) ──────────────
// Source : ha-triones, « Magic Blue » (Arduino). Service FFD5, écriture FFD9.

export const TRIONES: BleProfile = { service: uuid16('ffd5'), write: uuid16('ffd9') };

export const trionesPower = (on: boolean): number[] => [0xcc, on ? 0x23 : 0x24, 0x33];
export const trionesColor = ({ r, g, b }: Rgb): number[] => [0x56, r, g, b, 0x00, 0xf0, 0xaa];
/** Effet intégré (codes 0x25 à 0x38, voir `presets.ts`) et sa vitesse. */
export const trionesEffect = (code: number, speedPercent = 55): number[] => [0xbb, code, lednetDelay(speedPercent), 0x44];

// ── Magic Home en Bluetooth : Zengge (noms LEDnetWF, LEDBLE…) ──────────────────────────
// Source : flux_led / led-ble. Service FFFF, écriture FF01. Les messages Magic Home (voir `magicHome.ts`)
// sont emballés dans une enveloppe : 00, compteur, 80 00, longueur sur 2 octets, longueur + 1, 0B, message.

export const ZENGGE: BleProfile = { service: uuid16('ffff'), write: uuid16('ff01') };

export function zenggeWrap(inner: number[], counter: number): number[] {
  const len = inner.length;
  return [0x00, counter & 0xff, 0x80, 0x00, (len >> 8) & 0xff, len & 0xff, (len + 1) & 0xff, 0x0b, ...inner];
}

/** Couleur en teinte / saturation / valeur (contrôleurs Zengge récents, commande 0x3B). À confirmer. */
export function zenggeHsv(rgb: Rgb): number[] {
  const { h, s, v } = rgbToHsv(rgb);
  const body = [0x3b, 0xa1, clamp(h / 2, 0, 180), clamp(s * 100, 0, 100), clamp(v * 100, 0, 100), 0, 0, 0, 0, 0, 0, 0];
  return [...body, checksum(body)];
}

// ── SP110E et cousins (rubans à pixels, noms SP1xxE) ──────────────────────────────────
// Source : SP110E-HASS, sp110e (npm). Service FFE0, écriture FFE1, commandes de 4 octets [a, b, c, code].

export const SP110E: BleProfile = { service: uuid16('ffe0'), write: uuid16('ffe1') };

export const sp110ePower = (on: boolean): number[] => [0x00, 0x00, 0x00, on ? 0xaa : 0xab];
export const sp110eColor = ({ r, g, b }: Rgb): number[] => [r, g, b, 0x1e];
export const sp110eBrightness = (percent: number): number[] => [clamp((percent / 100) * 255, 0, 255), 0x00, 0x00, 0x2a];

// ── Philips Hue en Bluetooth ──────────────────────────────────────────────────────────
// Source : projets « hue-ble » (Python, Rust). Service 932C32BD-0000-…, une caractéristique par réglage.
// La lampe exige un appairage Android (écriture avec accusé). Les lampes s'annoncent avec le service FE0F (Signify).

const hueChar = (n: number): string => `932c32bd-000${n}-47a2-835a-a8d455b859dd`;
export const HUE_BLE_SERVICE = hueChar(0);
export const HUE_BLE_ADVERT = uuid16('fe0f');
export const HUE_BLE_POWER: BleProfile = { service: HUE_BLE_SERVICE, write: hueChar(2), withResponse: true };
export const HUE_BLE_BRIGHTNESS: BleProfile = { service: HUE_BLE_SERVICE, write: hueChar(3), withResponse: true };
export const HUE_BLE_COLOR: BleProfile = { service: HUE_BLE_SERVICE, write: hueChar(5), withResponse: true };
/** Blancs chaud / froid (mireds sur 16 bits, petit-boutiste). À confirmer sur une vraie lampe Hue Bluetooth. */
export const HUE_BLE_WHITE: BleProfile = { service: HUE_BLE_SERVICE, write: hueChar(4), withResponse: true };

export const hueBlePower = (on: boolean): number[] => [on ? 0x01 : 0x00];
export const hueBleBrightness = (percent: number): number[] => [clamp((percent / 100) * 254, 1, 254)];
export const hueBleWhite = (kelvin: number): number[] => {
  const m = kelvinToMired(kelvin);
  return [m & 0xff, (m >> 8) & 0xff];
};

/** Couleur → coordonnées CIE xy (sRGB, gamma retiré, matrice D65 de Philips). */
export function rgbToXy({ r, g, b }: Rgb): { x: number; y: number } {
  const lin = (c: number): number => {
    const v = c / 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const [rl, gl, bl] = [lin(r), lin(g), lin(b)];
  const X = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  const Y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const Z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;
  const sum = X + Y + Z;
  if (sum === 0) return { x: 0.3127, y: 0.329 }; // noir → point blanc
  return { x: X / sum, y: Y / sum };
}

/** xy sur 2 × 16 bits petit-boutiste (0-1 → 0-65535). */
export function hueBleColor(rgb: Rgb): number[] {
  const { x, y } = rgbToXy(rgb);
  const xx = clamp(x * 0xffff, 0, 0xffff);
  const yy = clamp(y * 0xffff, 0, 0xffff);
  return [xx & 0xff, xx >> 8, yy & 0xff, yy >> 8];
}
