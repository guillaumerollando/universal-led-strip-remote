import { PermissionsAndroid, Platform } from 'react-native';

import native from '../../modules/led-strip-native/src';
import { homeNetworks, parseWifiQr, setupSteps, waitingLights, type SetupAp, type WifiNetwork } from '../core/setupAp';

/** Une lumière qui attend d'être configurée, vue pendant la recherche. */
export type WaitingLight = WifiNetwork & { ap: SetupAp };

export const canSetupWifi = (): boolean => !!native?.wifiScan;

/**
 * Autorisation de voir les réseaux Wi-Fi autour : la localisation, sur toutes les versions d'Android (même 16,
 * « Appareils à proximité » ne suffit pas). Rien n'est localisé : seuls les noms des réseaux sont lus.
 */
export async function ensureWifiScanPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/** Depuis Android 10, le scan Wi-Fi ne voit rien si la localisation du téléphone est coupée. */
export function locationNeededButOff(): boolean {
  const state = native?.wifiSetupState?.();
  return !!state && Number(Platform.Version) >= 29 && !state[1];
}

let lastNetworks: WifiNetwork[] = [];
/** Lumières tout juste configurées : leur réseau peut traîner un moment dans la liste d'Android. */
const configured = new Map<string, number>();
const CONFIGURED_MS = 5 * 60_000;

/** Les réseaux autour (gardés pour l'écran de configuration) et les lumières qui attendent leur Wi-Fi. */
export async function scanWaitingLights(): Promise<WaitingLight[]> {
  if (!native?.wifiScan) return [];
  lastNetworks = await native.wifiScan().catch(() => lastNetworks);
  const now = Date.now();
  return waitingLights(lastNetworks).filter((l) => now - (configured.get(l.ssid) ?? 0) > CONFIGURED_MS);
}

/** Les Wi-Fi de la maison à proposer, le réseau actuel du téléphone en premier. */
export function homeChoices(): { networks: WifiNetwork[]; current: string | null } {
  const current = native?.wifiCurrentSsid?.() ?? null;
  return { networks: homeNetworks(lastNetworks, current), current };
}

/** Android sait-il se connecter au réseau de la lumière depuis l'appli (Android 10+) ? Sinon : réglages Wi-Fi. */
export const canConnectFromApp = (): boolean => !!native?.wifiSetupState?.()[2];

export type SetupProgress = 'connecting' | 'sending' | 'restarting';

export class SetupError extends Error {
  constructor(readonly reason: 'connect' | 'send') {
    super(reason);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Donne le Wi-Fi de la maison à la lumière : connexion à son réseau (Android demande l'accord), envoi du nom et du mot
 * de passe, puis retour sur le Wi-Fi de la maison. La lumière redémarre et rejoint la maison toute seule.
 * `manual` : le téléphone est déjà sur le réseau de la lumière (Android 9 et moins, réglé à la main).
 */
export async function giveHomeWifi(light: WaitingLight, ssid: string, password: string, onProgress: (p: SetupProgress) => void, manual = false): Promise<void> {
  if (!native?.apHttp || !native.apUdp) throw new SetupError('send');
  if (!manual) {
    onProgress('connecting');
    const ok = await native.wifiConnectAp!(light.ssid, light.ap.apPassword ?? null, 30_000).catch(() => false);
    if (!ok) throw new SetupError('connect');
  }
  try {
    onProgress('sending');
    // Laisser au réseau de la lumière le temps de donner une adresse au téléphone.
    await sleep(1500);
    let answered = false;
    for (const step of setupSteps(light.ap.method, ssid, password)) {
      if (step.kind === 'http') {
        const [status] = await native.apHttp(step.method, step.url, step.body ?? null, step.contentType ?? null, 8000);
        // -1 : coupée en route, elle redémarre déjà ; un statut HTTP : elle a reçu.
        answered ||= status === -1 || (status >= 200 && status < 400);
      } else {
        const replies = await native.apUdp(step.host, step.port, step.messages, 1500);
        answered ||= replies.some((r) => r.length > 0);
      }
    }
    if (!answered) throw new SetupError('send');
    configured.set(light.ssid, Date.now());
    onProgress('restarting');
  } finally {
    native.wifiReleaseAp?.();
  }
  // Le temps que la lumière redémarre et rejoigne la box.
  await sleep(12_000);
}

export const canScanQr = (): boolean => !!native?.scanQrCode;

export type WifiQr = { ssid: string; password: string } | 'cancelled' | 'not-wifi';

/**
 * QR code d'un Wi-Fi (« Partager le Wi-Fi » d'un autre téléphone, étiquette de la box) : nom et mot de passe.
 * `image` : dans une image choisie (capture d'écran du QR code) plutôt qu'avec l'appareil photo.
 */
export async function scanWifiQr(image = false): Promise<WifiQr> {
  const text = await (image ? native?.readQrFromImage?.() : native?.scanQrCode?.())?.catch(() => null);
  if (text == null) return 'cancelled';
  return parseWifiQr(text) ?? 'not-wifi';
}
