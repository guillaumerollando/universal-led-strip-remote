/**
 * Autorisations « par bouton » : pont Philips Hue et Nanoleaf. On presse un bouton sur l'appareil, l'appli reçoit
 * une clé locale (jamais de compte, rien ne sort du réseau de la maison). Les clés des ponts Hue sont gardées ici
 * pour retrouver leurs lampes à chaque recherche.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DetectedDevice } from '../core/identify';
import { hueLights, HUE_PAIR, NANOLEAF_PAIR, parseHueLights, parseHuePair, parseNanoleafToken } from '../core/protocols/wifi';
import { http } from './net';

const AUTH_KEY = 'ledstrip.bridges.v1';
type Bridges = Record<string, { user: string; ip: string }>;
let bridges: Bridges | null = null;

async function load(): Promise<Bridges> {
  if (!bridges) {
    const raw = await AsyncStorage.getItem(AUTH_KEY).catch(() => null);
    bridges = raw ? (JSON.parse(raw) as Bridges) : {};
  }
  return bridges;
}

export async function knownBridge(key: string): Promise<{ user: string } | undefined> {
  return (await load())[key];
}

/** Les lampes d'un pont Hue autorisé, prêtes à ajouter comme n'importe quel ruban. */
export async function hueLightsOf(bridge: DetectedDevice, user: string): Promise<DetectedDevice[]> {
  const id = bridge.meta?.bridge ?? bridge.address;
  return parseHueLights(await http(bridge.address, hueLights(user))).map((l) => ({
    key: `hue:${id}:${l.id}`,
    family: 'hue',
    confidence: 'sure',
    transport: 'wifi',
    rawName: l.name,
    address: bridge.address,
    meta: { user, light: l.id, product: l.product, color: l.color ? '1' : '0' },
  }));
}

export type PairResult = { ok: true; devices: DetectedDevice[] } | { ok: false; needButton: boolean };

/** Demande une clé au pont Hue (bouton du pont pressé dans les 30 s précédentes) et renvoie ses lampes. */
export async function pairHue(bridge: DetectedDevice): Promise<PairResult> {
  const res = parseHuePair(await http(bridge.address, HUE_PAIR));
  if (!res) return { ok: false, needButton: false };
  if ('needButton' in res) return { ok: false, needButton: true };
  const all = await load();
  all[bridge.key] = { user: res.user, ip: bridge.address };
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(all));
  return { ok: true, devices: await hueLightsOf(bridge, res.user) };
}

/** Demande un jeton au Nanoleaf (bouton marche tenu 5 à 7 s juste avant) ; renvoie l'appareil prêt à piloter. */
export async function pairNanoleaf(device: DetectedDevice): Promise<PairResult> {
  const token = parseNanoleafToken(await http(device.address, NANOLEAF_PAIR).catch(() => null));
  if (!token) return { ok: false, needButton: true };
  return { ok: true, devices: [{ ...device, meta: { ...device.meta, token } }] };
}
