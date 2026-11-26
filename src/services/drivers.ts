/**
 * Un pilote par famille : comment allumer, colorer, varier et lancer un effet. Le cœur (`src/core/protocols`)
 * fabrique les trames ; ici on les envoie par le bon canal (Bluetooth, HTTP, TCP, UDP).
 * `control.ts` reste la seule porte d'entrée pour l'interface.
 */
import { elkBrightness, elkColor, elkEffect, elkEffects, elkPower, elkSpeed, type ElkModel } from '../core/elk';
import type { FamilyId } from '../core/families';
import { elkModel } from '../core/identify';
import {
  HUE_BLE_BRIGHTNESS,
  HUE_BLE_COLOR,
  HUE_BLE_POWER,
  hueBleBrightness,
  hueBleColor,
  hueBlePower,
  SP110E,
  sp110eBrightness,
  sp110eColor,
  sp110ePower,
  TRIONES,
  trionesColor,
  trionesEffect,
  trionesPower,
  ZENGGE,
  zenggeHsv,
  zenggeWrap,
} from '../core/protocols/ble';
import { MAGIC_HOME_TCP_PORT, MH_QUERY, mhColor, mhEffect, mhNineBytes, mhPower, parseMhState } from '../core/protocols/magicHome';
import { LEDNET_PRESETS } from '../core/protocols/presets';
import { dim, type Effect, type Rgb } from '../core/protocols/types';
import { LIFX_PORT, lifxColor, lifxPower, macBytes, yeelightBrightness, yeelightColor, yeelightOk, yeelightPower } from '../core/protocols/udp';
import {
  elgatoBrightness,
  elgatoColor,
  elgatoPower,
  esphomeBrightness,
  esphomeColor,
  esphomePower,
  GOVEE_CONTROL_PORT,
  goveeBrightness,
  goveeColor,
  goveePower,
  hueBrightness,
  hueColor,
  huePower,
  nanoleafBrightness,
  nanoleafColor,
  nanoleafPower,
  parseEsphomeLights,
  shellyBrightness,
  shellyColor,
  shellyPower,
  tasmotaBrightness,
  tasmotaColor,
  tasmotaPower,
  wledBrightness,
  wledColor,
  wledEffect,
  WLED_EFFECTS,
  wledPower,
  type ShellyKind,
} from '../core/protocols/wifi';
import type { HttpCall } from '../core/protocols/types';
import { sendBle, sendElk } from './ble';
import { bytesToText, http, readEvents, tcp, udpSend } from './net';
import type { LightState } from './store';
import { t as tr } from '../i18n';

/** Ce qu'un pilote sait d'un appareil. */
export interface DriverTarget {
  key: string;
  family: string;
  address: string;
  rawName: string;
  model?: string;
  meta?: Record<string, string>;
  state?: LightState;
}

export interface Driver {
  power(t: DriverTarget, on: boolean): Promise<void>;
  color?(t: DriverTarget, rgb: Rgb): Promise<void>;
  brightness?(t: DriverTarget, percent: number): Promise<void>;
  effects?(t: DriverTarget): Effect[];
  effect?(t: DriverTarget, effect: Effect, speedPercent: number): Promise<void>;
  speed?(t: DriverTarget, percent: number): Promise<void>;
  /** Le réglage de couleur est-il disponible ? (par défaut oui si `color` existe) */
  hasColor?(t: DriverTarget): boolean;
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
/** La couleur actuelle, ramenée à une luminosité : pour les contrôleurs qui n'ont pas de commande de luminosité. */
const dimmed = (t: DriverTarget, percent: number): Rgb => dim(t.state?.rgb ?? WHITE, percent);
/** Une nouvelle couleur garde la luminosité choisie (contrôleurs sans commande de luminosité). */
const keepLevel = (t: DriverTarget, rgb: Rgb): Rgb => dim(rgb, t.state?.brightness ?? 100);
const currentEffect = (t: DriverTarget, list: Effect[]): Effect | undefined => list.find((e) => e.id === t.state?.effect);

// ── Bluetooth ──────────────────────────────────────────────────────────────────────

const elkOf = (t: DriverTarget): ElkModel => elkModel(t.rawName);
const elk: Driver = {
  power: (t, on) => sendElk(t.address, elkOf(t), elkPower(elkOf(t), on)),
  color: (t, rgb) => sendElk(t.address, elkOf(t), elkColor(elkOf(t), rgb)),
  brightness: (t, p) => sendElk(t.address, elkOf(t), elkBrightness(elkOf(t), p)),
  effects: (t) => elkEffects(elkOf(t)),
  effect: (t, e) => sendElk(t.address, elkOf(t), elkEffect(elkOf(t), e.code)),
  speed: (t, p) => sendElk(t.address, elkOf(t), elkSpeed(elkOf(t), p)),
};

const triones: Driver = {
  power: (t, on) => sendBle(t.address, TRIONES, trionesPower(on)),
  color: (t, rgb) => sendBle(t.address, TRIONES, trionesColor(keepLevel(t, rgb))),
  brightness: (t, p) => sendBle(t.address, TRIONES, trionesColor(dimmed(t, p))),
  effects: () => LEDNET_PRESETS,
  effect: (t, e, s) => sendBle(t.address, TRIONES, trionesEffect(e.code, s)),
  speed: async (t, p) => {
    const e = currentEffect(t, LEDNET_PRESETS);
    if (e) await sendBle(t.address, TRIONES, trionesEffect(e.code, p));
  },
};

let zenggeCounter = 0;
const zengge = (t: DriverTarget, ...inner: number[][]): Promise<void> =>
  sendBle(t.address, ZENGGE, ...inner.map((m) => zenggeWrap(m, ++zenggeCounter)));
const zenggeBle: Driver = {
  power: (t, on) => zengge(t, mhPower(on)),
  // Deux formes de couleur : les anciens modèles comprennent 0x31, les récents 0x3B (à confirmer).
  color: (t, rgb) => zengge(t, mhColor(keepLevel(t, rgb)), zenggeHsv(keepLevel(t, rgb))),
  brightness: (t, p) => zengge(t, mhColor(dimmed(t, p)), zenggeHsv(dimmed(t, p))),
  effects: () => LEDNET_PRESETS,
  effect: (t, e, s) => zengge(t, mhEffect(e.code, s)),
  speed: async (t, p) => {
    const e = currentEffect(t, LEDNET_PRESETS);
    if (e) await zengge(t, mhEffect(e.code, p));
  },
};

const sp110e: Driver = {
  power: (t, on) => sendBle(t.address, SP110E, sp110ePower(on)),
  color: (t, rgb) => sendBle(t.address, SP110E, sp110eColor(rgb)),
  brightness: (t, p) => sendBle(t.address, SP110E, sp110eBrightness(p)),
};

const hueBle: Driver = {
  power: (t, on) => sendBle(t.address, HUE_BLE_POWER, hueBlePower(on)),
  color: (t, rgb) => sendBle(t.address, HUE_BLE_COLOR, hueBleColor(rgb)),
  brightness: (t, p) => sendBle(t.address, HUE_BLE_BRIGHTNESS, hueBleBrightness(p)),
};

// ── Wi-Fi ──────────────────────────────────────────────────────────────────────────

/** Magic Home : le modèle (lu une fois par l'état) dit si la couleur tient sur 8 ou 9 octets. */
const mhModels = new Map<string, number>();
async function mhNine(t: DriverTarget): Promise<boolean> {
  if (!mhModels.has(t.address)) {
    const reply = await tcp(t.address, MAGIC_HOME_TCP_PORT, MH_QUERY, 14).catch(() => []);
    mhModels.set(t.address, parseMhState(reply)?.model ?? 0);
  }
  return mhNineBytes(mhModels.get(t.address) ?? 0);
}
const mh = (t: DriverTarget, bytes: number[]): Promise<unknown> => tcp(t.address, MAGIC_HOME_TCP_PORT, bytes);
const magicHome: Driver = {
  power: async (t, on) => void (await mh(t, mhPower(on))),
  color: async (t, rgb) => void (await mh(t, mhColor(keepLevel(t, rgb), await mhNine(t)))),
  brightness: async (t, p) => void (await mh(t, mhColor(dimmed(t, p), await mhNine(t)))),
  effects: () => LEDNET_PRESETS,
  effect: async (t, e, s) => void (await mh(t, mhEffect(e.code, s))),
  speed: async (t, p) => {
    const e = currentEffect(t, LEDNET_PRESETS);
    if (e) await mh(t, mhEffect(e.code, p));
  },
};

const govee = (t: DriverTarget, msg: string): Promise<void> => udpSend(t.address, GOVEE_CONTROL_PORT, msg);
const goveeLan: Driver = {
  power: (t, on) => govee(t, goveePower(on)),
  color: (t, rgb) => govee(t, goveeColor(rgb)),
  brightness: (t, p) => govee(t, goveeBrightness(p)),
};

const call = (t: DriverTarget, c: HttpCall): Promise<void> => http(t.address, c).then(() => undefined);

const wled: Driver = {
  power: (t, on) => call(t, wledPower(on)),
  color: (t, rgb) => call(t, wledColor(rgb)),
  brightness: (t, p) => call(t, wledBrightness(p)),
  effects: () => WLED_EFFECTS,
  effect: (t, e, s) => call(t, wledEffect(e.code, s)),
  speed: async (t, p) => {
    const e = currentEffect(t, WLED_EFFECTS);
    if (e) await call(t, wledEffect(e.code, p));
  },
};

/** Shelly 2e génération : profil RGBW par défaut, RGB si l'appareil refuse. */
async function shellyCall(t: DriverTarget, make: (kind: ShellyKind) => HttpCall): Promise<void> {
  const kind = (t.meta?.shelly as ShellyKind | undefined) ?? 'gen1';
  try {
    await call(t, make(kind));
  } catch (e) {
    if (kind !== 'rgbw') throw e;
    await call(t, make('rgb'));
  }
}
const shelly: Driver = {
  power: (t, on) => shellyCall(t, (k) => shellyPower(k, on)),
  color: (t, rgb) => shellyCall(t, (k) => shellyColor(k, rgb)),
  brightness: (t, p) => shellyCall(t, (k) => shellyBrightness(k, p)),
};

const tasmota: Driver = {
  power: (t, on) => call(t, tasmotaPower(on)),
  color: (t, rgb) => call(t, tasmotaColor(rgb)),
  brightness: (t, p) => call(t, tasmotaBrightness(p)),
};

/** ESPHome : le nom de la lumière se lit une fois dans le flux `/events`. */
const esphomeIds = new Map<string, string>();
async function esphomeLight(t: DriverTarget): Promise<string> {
  const known = t.meta?.light ?? esphomeIds.get(t.address);
  if (known) return known;
  const id = parseEsphomeLights(await readEvents(`http://${t.address}/events`))[0];
  if (!id) throw new Error(tr('Pas de réponse : vérifie qu’il est allumé et sur le même Wi-Fi.'));
  esphomeIds.set(t.address, id);
  return id;
}
const esphome: Driver = {
  power: async (t, on) => call(t, esphomePower(await esphomeLight(t), on)),
  color: async (t, rgb) => call(t, esphomeColor(await esphomeLight(t), rgb)),
  brightness: async (t, p) => call(t, esphomeBrightness(await esphomeLight(t), p)),
};

async function yee(t: DriverTarget, cmd: string): Promise<void> {
  const reply = bytesToText(await tcp(t.address, Number(t.meta?.port ?? 55443), cmd, -1));
  if (reply && !yeelightOk(reply)) throw new Error(tr('Pas de réponse : vérifie qu’il est allumé et sur le même Wi-Fi.'));
}
const yeelight: Driver = {
  power: (t, on) => yee(t, yeelightPower(on)),
  color: (t, rgb) => yee(t, yeelightColor(rgb)),
  brightness: (t, p) => yee(t, yeelightBrightness(p)),
  hasColor: (t) => t.meta?.color !== '0',
};

const lifxMac = (t: DriverTarget): number[] => macBytes(t.meta?.mac ?? '');
const lifx: Driver = {
  power: (t, on) => udpSend(t.address, LIFX_PORT, lifxPower(lifxMac(t), on)),
  color: (t, rgb) => udpSend(t.address, LIFX_PORT, lifxColor(lifxMac(t), rgb, t.state?.brightness)),
  brightness: (t, p) => udpSend(t.address, LIFX_PORT, lifxColor(lifxMac(t), t.state?.rgb ?? WHITE, p)),
};

const token = (t: DriverTarget): string => t.meta?.token ?? '';
const nanoleaf: Driver = {
  power: (t, on) => call(t, nanoleafPower(token(t), on)),
  color: (t, rgb) => call(t, nanoleafColor(token(t), rgb)),
  brightness: (t, p) => call(t, nanoleafBrightness(token(t), p)),
};

const elgato: Driver = {
  power: (t, on) => call(t, elgatoPower(on)),
  color: (t, rgb) => call(t, elgatoColor(rgb)),
  brightness: (t, p) => call(t, elgatoBrightness(p)),
  hasColor: (t) => t.meta?.color !== '0',
};

const hueUser = (t: DriverTarget): string => t.meta?.user ?? '';
const hueId = (t: DriverTarget): string => t.meta?.light ?? '';
const hue: Driver = {
  power: (t, on) => call(t, huePower(hueUser(t), hueId(t), on)),
  color: (t, rgb) => call(t, hueColor(hueUser(t), hueId(t), rgb)),
  brightness: (t, p) => call(t, hueBrightness(hueUser(t), hueId(t), p)),
  hasColor: (t) => t.meta?.color !== '0',
};

const DRIVERS: Partial<Record<FamilyId, Driver>> = {
  'elk-bledom': elk,
  triones,
  'zengge-ble': zenggeBle,
  sp110e,
  'hue-ble': hueBle,
  'magichome-wifi': magicHome,
  'govee-lan': goveeLan,
  wled,
  shelly,
  tasmota,
  esphome,
  yeelight,
  lifx,
  nanoleaf,
  elgato,
  hue,
};

/** Le pilote d'un appareil, ou undefined si l'appli ne sait pas (encore) le piloter. */
export function driverOf(t: { family: string; meta?: Record<string, string> }): Driver | undefined {
  const d = DRIVERS[t.family as FamilyId];
  // Nanoleaf : rien à faire tant que le bouton n'a pas donné de jeton.
  if (t.family === 'nanoleaf' && !t.meta?.token) return undefined;
  if (t.family === 'hue' && !t.meta?.user) return undefined;
  return d;
}
