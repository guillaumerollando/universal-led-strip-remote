/**
 * Yeelight (découverte UDP 1982 + commandes JSON en TCP 55443, « contrôle LAN » à activer dans l'appli Yeelight)
 * et LIFX (protocole LAN binaire public, UDP 56700). Sources : « Yeelight WiFi Light Inter-Operation Specification »,
 * lan.developer.lifx.com. **À confirmer** sur un vrai appareil.
 */
import { rgbToHsv } from '../color';
import { clamp, type Rgb } from './types';

// ── Yeelight ────────────────────────────────────────────────────────────────────────

export const YEELIGHT_MULTICAST = '239.255.255.250';
export const YEELIGHT_DISCOVERY_PORT = 1982;
export const YEELIGHT_PROBE = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1982\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n';

export interface YeelightInfo {
  id: string;
  ip: string;
  port: number;
  model: string;
  name: string;
  color: boolean;
}

/** Lit une réponse (ou une annonce NOTIFY) de découverte Yeelight : des en-têtes façon HTTP. */
export function parseYeelight(text: string): YeelightInfo | null {
  const headers = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) headers.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
  }
  const loc = /^yeelight:\/\/([\d.]+):(\d+)/.exec(headers.get('location') ?? '');
  const id = headers.get('id');
  if (!loc || !id) return null;
  const support = headers.get('support') ?? '';
  return {
    id,
    ip: loc[1],
    port: Number(loc[2]),
    model: headers.get('model') ?? '',
    name: headers.get('name') ?? '',
    color: /\bset_rgb\b/.test(support),
  };
}

/** Nom compréhensible d'un modèle Yeelight. */
export function yeelightModelName(model: string): string {
  const names: Record<string, string> = {
    stripe: 'Yeelight Lightstrip',
    strip1: 'Yeelight Lightstrip',
    color: 'Yeelight Bulb',
    color4: 'Yeelight Bulb',
    colorc: 'Yeelight GU10',
    bslamp: 'Yeelight Bedside Lamp',
    ceiling: 'Yeelight Ceiling Light',
    lamp15: 'Yeelight Monitor Light Bar',
  };
  return names[model] ?? 'Yeelight';
}

let yeelightId = 1;
/** Une commande JSON, terminée par CRLF comme l'exige la spécification. */
const yee = (method: string, params: unknown[]): string => `${JSON.stringify({ id: yeelightId++, method, params })}\r\n`;
export const yeelightPower = (on: boolean): string => yee('set_power', [on ? 'on' : 'off', 'smooth', 300]);
export const yeelightColor = ({ r, g, b }: Rgb): string => yee('set_rgb', [(r << 16) | (g << 8) | b, 'smooth', 300]);
export const yeelightBrightness = (percent: number): string => yee('set_bright', [clamp(percent, 1, 100), 'smooth', 300]);
/** La lampe répond `{"id":…,"result":["ok"]}` ou `{"id":…,"error":{…}}`. */
export const yeelightOk = (reply: string): boolean => /"result"\s*:\s*\[\s*"ok"/.test(reply);

// ── LIFX ────────────────────────────────────────────────────────────────────────────

export const LIFX_PORT = 56700;
/** Identifiant de l'appli dans les trames (« source ») : arbitraire mais non nul. */
const SOURCE = 0x4c454453; // « LEDS »

export const LIFX_TYPE = {
  GetService: 2,
  StateService: 3,
  GetLabel: 23,
  StateLabel: 25,
  GetVersion: 32,
  StateVersion: 33,
  SetColor: 102,
  SetLightPower: 117,
} as const;

/**
 * Trame LIFX : en-tête de 36 octets petit-boutiste + charge utile.
 * `target` = adresse MAC (6 octets) ; absente → trame « tagged » adressée à tous (découverte).
 */
export function lifxFrame(type: number, payload: number[] = [], target?: number[], sequence = 0): number[] {
  const size = 36 + payload.length;
  const out = new Array<number>(size).fill(0);
  const u16 = (o: number, v: number): void => {
    out[o] = v & 0xff;
    out[o + 1] = (v >> 8) & 0xff;
  };
  const u32 = (o: number, v: number): void => {
    for (let i = 0; i < 4; i++) out[o + i] = (v >>> (8 * i)) & 0xff;
  };
  u16(0, size);
  u16(2, 1024 | 0x1000 | (target ? 0 : 0x2000)); // protocole 1024, adressable, tagged si broadcast
  u32(4, SOURCE);
  if (target) target.slice(0, 6).forEach((b, i) => (out[8 + i] = b));
  out[22] = 0; // pas d'accusé demandé
  out[23] = sequence & 0xff;
  u16(32, type);
  payload.forEach((b, i) => (out[36 + i] = b));
  return out;
}

const le16 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff];
const le32 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];

export const lifxPower = (mac: number[], on: boolean): number[] => lifxFrame(LIFX_TYPE.SetLightPower, [...le16(on ? 0xffff : 0), ...le32(300)], mac);

/** Couleur en HSBK (teinte, saturation, luminosité sur 16 bits, température 3500 K). */
export function lifxColor(mac: number[], rgb: Rgb, brightnessPercent?: number): number[] {
  const { h, s, v } = rgbToHsv(rgb);
  const bri = brightnessPercent !== undefined ? brightnessPercent / 100 : v;
  return lifxFrame(
    LIFX_TYPE.SetColor,
    [0, ...le16(clamp((h / 360) * 0xffff, 0, 0xffff)), ...le16(clamp(s * 0xffff, 0, 0xffff)), ...le16(clamp(bri * 0xffff, 0, 0xffff)), ...le16(3500), ...le32(300)],
    mac,
  );
}

export interface LifxReply {
  type: number;
  mac: number[];
  payload: number[];
}
export function parseLifx(bytes: number[]): LifxReply | null {
  if (bytes.length < 36) return null;
  const size = bytes[0] | (bytes[1] << 8);
  const protocol = (bytes[2] | (bytes[3] << 8)) & 0xfff;
  if (size !== bytes.length || protocol !== 1024) return null;
  return { type: bytes[32] | (bytes[33] << 8), mac: bytes.slice(8, 14), payload: bytes.slice(36) };
}

/** Nom de la lampe (StateLabel : 32 octets UTF-8 complétés de zéros). */
export function lifxLabel(payload: number[]): string {
  const end = payload.indexOf(0);
  return String.fromCharCode(...payload.slice(0, end < 0 ? 32 : end)).trim();
}

export const macHex = (mac: number[]): string => mac.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
export const macBytes = (hex: string): number[] => (hex.match(/../g) ?? []).map((h) => parseInt(h, 16));
