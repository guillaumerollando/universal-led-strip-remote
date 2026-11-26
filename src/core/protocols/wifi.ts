/**
 * Appareils Wi-Fi à API locale ouverte, pilotés en HTTP / JSON sans compte.
 * Chaque fonction décrit la requête à faire (`HttpCall`) : le service (`services/http.ts`) l'envoie.
 * Sources : documentation officielle de chaque fabricant ou projet (liens dans le vault, `protocoles.md`).
 * Tout est **à confirmer** sur un vrai appareil.
 */
import { rgbToHsv } from '../color';
import { clamp, type Effect, type HttpCall, type Rgb } from './types';

const R: Rgb = { r: 255, g: 0, b: 0 };
const O: Rgb = { r: 255, g: 100, b: 0 };
const Y: Rgb = { r: 255, g: 220, b: 0 };
const G: Rgb = { r: 0, g: 255, b: 0 };
const C: Rgb = { r: 0, g: 230, b: 255 };
const B: Rgb = { r: 0, g: 0, b: 255 };
const M: Rgb = { r: 255, g: 0, b: 200 };
const W: Rgb = { r: 255, g: 255, b: 255 };
const K: Rgb = { r: 0, g: 0, b: 0 };
const RAINBOW = [R, O, Y, G, C, B, M];

// ── WLED (kno.wled.ge/interfaces/json-api) ──────────────────────────────────────────

export const wledPower = (on: boolean): HttpCall => ({ method: 'POST', path: '/json/state', body: { on } });
export const wledColor = ({ r, g, b }: Rgb): HttpCall => ({
  method: 'POST',
  path: '/json/state',
  body: { on: true, seg: [{ col: [[r, g, b]], fx: 0 }] },
});
export const wledBrightness = (percent: number): HttpCall => ({
  method: 'POST',
  path: '/json/state',
  body: { on: true, bri: clamp((percent / 100) * 255, 1, 255) },
});
/** `code` = numéro d'effet WLED ; la vitesse (0-100 %) va dans `sx` (0-255). */
export const wledEffect = (code: number, speedPercent = 55): HttpCall => ({
  method: 'POST',
  path: '/json/state',
  body: { on: true, seg: [{ fx: code, sx: clamp((speedPercent / 100) * 255, 0, 255) }] },
});
export const WLED_INFO: HttpCall = { method: 'GET', path: '/json/info' };

/** Effets WLED choisis (numéros stables depuis WLED 0.10), libellés déjà traduits dans l'appli. */
export const WLED_EFFECTS: Effect[] = [
  { id: 'rainbow', label: 'Arc-en-ciel', code: 9, preview: RAINBOW },
  { id: 'fade7', label: 'Fondu 7 couleurs', code: 8, preview: RAINBOW },
  { id: 'fade', label: 'Fondu', code: 2, preview: [W, { r: 40, g: 40, b: 40 }] },
  { id: 'chase', label: 'Poursuite', code: 28, preview: [R, K, B] },
  { id: 'chase-flow', label: 'Flot', code: 3, preview: [B, C, G] },
  { id: 'blink7', label: 'Clignote 7 couleurs', code: 1, preview: RAINBOW },
  { id: 'fire', label: 'Feu', code: 66, preview: [R, O, Y] },
];

export interface WledInfo {
  name: string;
  leds: number;
  version?: string;
}
export function parseWledInfo(json: unknown): WledInfo | null {
  const j = json as { name?: string; ver?: string; brand?: string; leds?: { count?: number } } | null;
  if (!j || typeof j !== 'object' || !j.leds || (j.brand && j.brand !== 'WLED')) return null;
  return { name: j.name ?? 'WLED', leds: j.leds.count ?? 0, version: j.ver };
}

// ── Govee, API locale (UDP 4003, à activer une fois dans Govee Home) ─────────────────
// developer.govee.com › LAN API

export const GOVEE_CONTROL_PORT = 4003;
const govee = (cmd: string, data: unknown): string => JSON.stringify({ msg: { cmd, data } });
export const goveePower = (on: boolean): string => govee('turn', { value: on ? 1 : 0 });
export const goveeBrightness = (percent: number): string => govee('brightness', { value: clamp(percent, 1, 100) });
export const goveeColor = ({ r, g, b }: Rgb): string => govee('colorwc', { color: { r, g, b }, colorTemInKelvin: 0 });

// ── Shelly (shelly-api-docs.shelly.cloud) ───────────────────────────────────────────
// 1re génération (RGBW2, Bulb) : /color/0 ; génération 2 et + (Plus RGBW PM…) : RPC RGB.Set / RGBW.Set.

export type ShellyKind = 'gen1' | 'rgb' | 'rgbw';

export function shellyPower(kind: ShellyKind, on: boolean): HttpCall {
  if (kind === 'gen1') return { method: 'GET', path: `/color/0?turn=${on ? 'on' : 'off'}` };
  return { method: 'GET', path: `/rpc/${kind === 'rgb' ? 'RGB' : 'RGBW'}.Set?id=0&on=${on}` };
}
export function shellyColor(kind: ShellyKind, { r, g, b }: Rgb): HttpCall {
  if (kind === 'gen1') return { method: 'GET', path: `/color/0?turn=on&red=${r}&green=${g}&blue=${b}&white=0` };
  return { method: 'GET', path: `/rpc/${kind === 'rgb' ? 'RGB' : 'RGBW'}.Set?id=0&on=true&rgb=${encodeURIComponent(`[${r},${g},${b}]`)}` };
}
export function shellyBrightness(kind: ShellyKind, percent: number): HttpCall {
  const p = clamp(percent, 1, 100);
  if (kind === 'gen1') return { method: 'GET', path: `/color/0?turn=on&gain=${p}` };
  return { method: 'GET', path: `/rpc/${kind === 'rgb' ? 'RGB' : 'RGBW'}.Set?id=0&on=true&brightness=${p}` };
}
export const SHELLY_INFO: HttpCall = { method: 'GET', path: '/shelly' };

/** Lit `/shelly` : renvoie le type de lumière et le modèle, ou null si ce n'est pas une lumière Shelly en couleur. */
export function parseShellyInfo(json: unknown): { kind: ShellyKind; model: string } | null {
  const j = json as { type?: string; gen?: number; app?: string; model?: string } | null;
  if (!j || typeof j !== 'object') return null;
  if (!j.gen && j.type) {
    // RGBW2 (SHRGBW2), Bulb RGBW (SHCB-1), Bulb (SHBLB-1)
    if (/^(SHRGBW2|SHCB-1|SHBLB-1)/.test(j.type)) return { kind: 'gen1', model: j.type };
    return null;
  }
  if (j.gen && j.gen >= 2 && /RGBW/i.test(j.app ?? '')) return { kind: 'rgbw', model: j.app ?? j.model ?? 'Shelly' };
  return null;
}

/** Nom compréhensible d'un modèle Shelly. */
export function shellyModelName(model: string): string {
  if (model.startsWith('SHRGBW2')) return 'Shelly RGBW2';
  if (model.startsWith('SHCB-1')) return 'Shelly Duo RGBW';
  if (model.startsWith('SHBLB-1')) return 'Shelly Bulb';
  if (/PlusRGBWPM/i.test(model)) return 'Shelly Plus RGBW PM';
  return 'Shelly';
}

// ── Tasmota (tasmota.github.io/docs/Commands) ───────────────────────────────────────

const tasmota = (cmnd: string): HttpCall => ({ method: 'GET', path: `/cm?cmnd=${encodeURIComponent(cmnd)}` });
export const tasmotaPower = (on: boolean): HttpCall => tasmota(`Power ${on ? 'On' : 'Off'}`);
const hex2 = (n: number): string => n.toString(16).padStart(2, '0').toUpperCase();
export const tasmotaColor = ({ r, g, b }: Rgb): HttpCall => tasmota(`Color ${hex2(r)}${hex2(g)}${hex2(b)}`);
export const tasmotaBrightness = (percent: number): HttpCall => tasmota(`Dimmer ${clamp(percent, 1, 100)}`);
export const TASMOTA_STATUS: HttpCall = tasmota('Status 0');

/** Lit la réponse à « Status 0 » : un nom, et si c'est une lumière en couleur (champ Color dans StatusSTS). */
export function parseTasmotaStatus(json: unknown): { name: string; color: boolean } | null {
  const j = json as { Status?: { DeviceName?: string; FriendlyName?: string[] }; StatusSTS?: { Color?: string; Dimmer?: number } } | null;
  if (!j?.Status || !j.StatusSTS) return null;
  if (j.StatusSTS.Dimmer === undefined && j.StatusSTS.Color === undefined) return null;
  return { name: j.Status.DeviceName ?? j.Status.FriendlyName?.[0] ?? 'Tasmota', color: (j.StatusSTS.Color ?? '').length >= 6 };
}

// ── Nanoleaf, « Open API » (port 16021, jeton obtenu en tenant le bouton marche 5 à 7 s) ──

export const NANOLEAF_PORT = 16021;
export const NANOLEAF_PAIR: HttpCall = { method: 'POST', path: '/api/v1/new', port: NANOLEAF_PORT };
const nano = (token: string, body: unknown): HttpCall => ({ method: 'PUT', path: `/api/v1/${token}/state`, body, port: NANOLEAF_PORT });
export const nanoleafPower = (token: string, on: boolean): HttpCall => nano(token, { on: { value: on } });
export const nanoleafBrightness = (token: string, percent: number): HttpCall => nano(token, { brightness: { value: clamp(percent, 0, 100) } });
export function nanoleafColor(token: string, rgb: Rgb): HttpCall {
  const { h, s, v } = rgbToHsv(rgb);
  return nano(token, { hue: { value: clamp(h, 0, 360) }, sat: { value: clamp(s * 100, 0, 100) }, brightness: { value: clamp(v * 100, 1, 100) } });
}
export const parseNanoleafToken = (json: unknown): string | null => (json as { auth_token?: string } | null)?.auth_token ?? null;

/** Nom compréhensible d'après le modèle Nanoleaf (« NL42 » → Shapes). */
export function nanoleafModelName(model?: string): string {
  const names: Record<string, string> = {
    NL22: 'Nanoleaf Light Panels',
    NL29: 'Nanoleaf Canvas',
    NL42: 'Nanoleaf Shapes',
    NL47: 'Nanoleaf Shapes',
    NL48: 'Nanoleaf Shapes',
    NL52: 'Nanoleaf Elements',
    NL55: 'Nanoleaf Lightstrip',
    NL59: 'Nanoleaf Lines',
    NL69: 'Nanoleaf 4D',
  };
  return (model && names[model.toUpperCase()]) || 'Nanoleaf';
}

// ── Elgato Light Strip (port 9123, API locale publique de Control Center) ───────────

export const ELGATO_PORT = 9123;
export const ELGATO_INFO: HttpCall = { method: 'GET', path: '/elgato/accessory-info', port: ELGATO_PORT };
const elgato = (light: Record<string, number>): HttpCall => ({
  method: 'PUT',
  path: '/elgato/lights',
  body: { numberOfLights: 1, lights: [light] },
  port: ELGATO_PORT,
});
export const elgatoPower = (on: boolean): HttpCall => elgato({ on: on ? 1 : 0 });
export const elgatoBrightness = (percent: number): HttpCall => elgato({ on: 1, brightness: clamp(percent, 1, 100) });
export function elgatoColor(rgb: Rgb): HttpCall {
  const { h, s } = rgbToHsv(rgb);
  return elgato({ on: 1, hue: clamp(h, 0, 360), saturation: clamp(s * 100, 0, 100) });
}
/** Le Light Strip est le seul Elgato en couleur ; les Key Light (blanc seulement) sont ignorés. */
export function parseElgatoInfo(json: unknown): { name: string; color: boolean } | null {
  const j = json as { productName?: string; displayName?: string } | null;
  if (!j?.productName) return null;
  return { name: j.displayName || j.productName, color: /strip/i.test(j.productName) };
}

// ── Philips Hue, pont (API locale v1, autorisation en appuyant sur le bouton du pont) ──

export const HUE_PAIR: HttpCall = { method: 'POST', path: '/api', body: { devicetype: 'ledstrip#android' } };
export const hueLights = (user: string): HttpCall => ({ method: 'GET', path: `/api/${user}/lights` });
const hueState = (user: string, id: string, body: unknown): HttpCall => ({ method: 'PUT', path: `/api/${user}/lights/${id}/state`, body });
export const huePower = (user: string, id: string, on: boolean): HttpCall => hueState(user, id, { on });
export const hueBrightness = (user: string, id: string, percent: number): HttpCall =>
  hueState(user, id, { on: true, bri: clamp((percent / 100) * 254, 1, 254) });
export function hueColor(user: string, id: string, rgb: Rgb): HttpCall {
  const { h, s } = rgbToHsv(rgb);
  return hueState(user, id, { on: true, hue: clamp((h / 360) * 65535, 0, 65535), sat: clamp(s * 254, 0, 254) });
}

/** Réponse à l'autorisation : le nom d'utilisateur, ou « bouton pas appuyé » (erreur 101). */
export function parseHuePair(json: unknown): { user: string } | { needButton: true } | null {
  const first = Array.isArray(json) ? (json[0] as { success?: { username?: string }; error?: { type?: number } }) : null;
  if (first?.success?.username) return { user: first.success.username };
  if (first?.error?.type === 101) return { needButton: true };
  return null;
}

export interface HueLight {
  id: string;
  name: string;
  product: string;
  color: boolean;
}
/** Les lampes du pont qui savent faire de la couleur ou varier (les prises sont ignorées). */
export function parseHueLights(json: unknown): HueLight[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  return Object.entries(json as Record<string, { name?: string; type?: string; productname?: string }>)
    .filter(([, l]) => /color|dimmable/i.test(l.type ?? ''))
    .map(([id, l]) => ({ id, name: l.name ?? `Hue ${id}`, product: l.productname ?? 'Philips Hue', color: /color/i.test(l.type ?? '') }));
}

// ── ESPHome, composant web_server (esphome.io/web-api) ──────────────────────────────

const esph = (id: string, action: string, query = ''): HttpCall => ({ method: 'POST', path: `/light/${id}/${action}${query}` });
export const esphomePower = (id: string, on: boolean): HttpCall => esph(id, on ? 'turn_on' : 'turn_off');
export const esphomeColor = (id: string, { r, g, b }: Rgb): HttpCall => esph(id, 'turn_on', `?r=${r}&g=${g}&b=${b}`);
export const esphomeBrightness = (id: string, percent: number): HttpCall =>
  esph(id, 'turn_on', `?brightness=${clamp((percent / 100) * 255, 1, 255)}`);

/** Cherche les lumières dans le flux `/events` (lignes `data: {"id":"light-salon",…}`). */
export function parseEsphomeLights(events: string): string[] {
  const ids = new Set<string>();
  for (const m of events.matchAll(/"id"\s*:\s*"light-([^"]+)"/g)) ids.add(m[1]);
  return [...ids];
}
