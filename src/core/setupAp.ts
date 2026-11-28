/**
 * Lumières Wi-Fi pas encore configurées. Sortie d'usine (ou après une remise à zéro), une lumière Wi-Fi ne connaît pas
 * la box : elle crée son propre petit réseau Wi-Fi et attend qu'on lui donne le nom et le mot de passe de la maison.
 * Ici : reconnaître ces réseaux à leur nom, et préparer ce qu'il faut leur envoyer. Tout est « à confirmer » sur un
 * vrai appareil, sauf OpenBeken (formulaire lu sur le ruban de Guillaume, 2026-11-28).
 */
import type { FamilyId } from './families';

/** Comment donner le Wi-Fi de la maison à la lumière, une fois connecté à son réseau. */
export type SetupMethod = 'openbeken' | 'tasmota' | 'wled' | 'esphome' | 'shelly1' | 'shelly2' | 'magichome' | 'closed';

export interface SetupAp {
  family: FamilyId;
  method: SetupMethod;
  /** Mot de passe du réseau de la lumière s'il en a un connu d'usine (WLED : « wled1234 »). */
  apPassword?: string;
}

/** Un réseau Wi-Fi vu par le téléphone. */
export interface WifiNetwork {
  ssid: string;
  /** Fréquence en MHz (2412…2484 = 2,4 GHz). */
  frequency: number;
  /** Force du signal en dBm. */
  level: number;
  /** Protégé par un mot de passe. */
  secure: boolean;
}

/** Noms des réseaux créés par les lumières à configurer, du plus sûr au plus vague. */
const PATTERNS: { re: RegExp; ap: SetupAp }[] = [
  { re: /^OpenBK|^OpenBeken|^OBK[_-]/i, ap: { family: 'openbeken', method: 'openbeken' } },
  { re: /^tasmota[-_]/i, ap: { family: 'tasmota', method: 'tasmota' } },
  { re: /^WLED-AP$|^WLED[-_]/i, ap: { family: 'wled', method: 'wled', apPassword: 'wled1234' } },
  { re: / Fallback Hotspot$/i, ap: { family: 'esphome', method: 'esphome' } },
  // Shelly : « ShellyPlusRGBWPM-… », « ShellyPro4PM-… » (2e génération et plus) ; « shellyrgbw2-… » (1re génération).
  { re: /^Shelly(Plus|Pro|Mini|Wall|Pill)/, ap: { family: 'shelly', method: 'shelly2' } },
  { re: /^shelly[a-z0-9]*-[0-9A-F]{6,12}$/i, ap: { family: 'shelly', method: 'shelly1' } },
  { re: /^LEDnet|^Magic ?Home|^HF-LPB100/i, ap: { family: 'magichome-wifi', method: 'magichome' } },
  // Systèmes fermés : on les reconnaît pour expliquer quoi faire, sans les configurer.
  { re: /^SmartLife[-_]|^Tuya[-_]/i, ap: { family: 'tuya', method: 'closed' } },
  { re: /^yeelink-light-|^yeelight/i, ap: { family: 'yeelight', method: 'closed' } },
  { re: /^LIFX[ _]/i, ap: { family: 'lifx', method: 'closed' } },
];

/** Ce réseau est-il celui d'une lumière qui attend d'être configurée ? */
export function setupApOf(ssid: string): SetupAp | undefined {
  return PATTERNS.find((p) => p.re.test(ssid.trim()))?.ap;
}

/** 2,4 GHz : la seule bande que ces petits contrôleurs comprennent. */
export const is24GHz = (n: Pick<WifiNetwork, 'frequency'>): boolean => n.frequency > 2300 && n.frequency < 2500;

/** Les lumières à configurer parmi les réseaux vus, une fois chacune, la plus proche d'abord. */
export function waitingLights(networks: WifiNetwork[]): (WifiNetwork & { ap: SetupAp })[] {
  const seen = new Map<string, WifiNetwork & { ap: SetupAp }>();
  for (const n of networks) {
    const ap = setupApOf(n.ssid);
    const prev = seen.get(n.ssid);
    if (ap && (!prev || n.level > prev.level)) seen.set(n.ssid, { ...n, ap });
  }
  return [...seen.values()].sort((a, b) => b.level - a.level);
}

/** Nom d'un réseau sans son suffixe 5 GHz (« SFR_B8E8_5GHZ », « Livebox-5G » → « SFR_B8E8 », « Livebox »). */
const baseName = (ssid: string): string => ssid.replace(/[-_ ]?5\s?G(hz)?$/i, '').toLowerCase();

/**
 * Les réseaux de la maison qu'on peut proposer : pas ceux des lumières, un seul par nom (le plus fort), le réseau
 * actuel du téléphone en premier, puis les 2,4 GHz, puis les autres (un 5 GHz seul ne marchera pas : on prévient).
 * Téléphone sur le 5 GHz d'une box (« SFR_B8E8_5GHZ ») : le 2,4 GHz de la même box (« SFR_B8E8 ») passe devant.
 */
export function homeNetworks(networks: WifiNetwork[], current?: string | null): WifiNetwork[] {
  const best = new Map<string, WifiNetwork>();
  for (const n of networks) {
    if (!n.ssid.trim() || setupApOf(n.ssid)) continue;
    const prev = best.get(n.ssid);
    // Un même nom en 2,4 et 5 GHz (box bi-bande) : on garde la version 2,4 GHz.
    if (!prev || (is24GHz(n) && !is24GHz(prev)) || (is24GHz(n) === is24GHz(prev) && n.level > prev.level)) best.set(n.ssid, n);
  }
  const cur = current ? best.get(current) : undefined;
  const sibling = cur && !is24GHz(cur) ? [...best.values()].find((n) => n.ssid !== current && is24GHz(n) && baseName(n.ssid) === baseName(current!)) : undefined;
  const rank = (n: WifiNetwork): number => (n === sibling ? 0 : n.ssid === current ? 1 : is24GHz(n) ? 2 : 3);
  return [...best.values()].sort((a, b) => rank(a) - rank(b) || b.level - a.level);
}

/** Une requête à envoyer à la lumière sur son propre réseau. */
export type SetupStep =
  | { kind: 'http'; method: 'GET' | 'POST'; url: string; body?: string; contentType?: string }
  | { kind: 'udp'; host: string; port: number; messages: string[] };

const q = encodeURIComponent;
const form = (fields: Record<string, string>): string =>
  Object.entries(fields)
    .map(([k, v]) => `${q(k)}=${q(v)}`)
    .join('&');

/**
 * Ce qu'il faut envoyer pour que la lumière rejoigne le Wi-Fi de la maison. Elle redémarre ensuite toute seule :
 * une réponse coupée en route est normale.
 */
export function setupSteps(method: SetupMethod, ssid: string, password: string): SetupStep[] {
  switch (method) {
    case 'openbeken':
      // ✅ Formulaire « /cfg_wifi_set » relu sur le ruban de Guillaume (champs ssid / pass).
      return [{ kind: 'http', method: 'GET', url: `http://192.168.4.1/cfg_wifi_set?${form({ ssid, pass: password })}` }];
    case 'tasmota':
      // À confirmer : gestionnaire Wi-Fi de Tasmota (« /wi », champs s1 / p1).
      return [{ kind: 'http', method: 'GET', url: `http://192.168.4.1/wi?${form({ s1: ssid, p1: password, save: '' })}` }];
    case 'wled':
      // À confirmer : WLED en point d'accès répond en 4.3.2.1 ; champs CS0 / CP0 (récents), CS / CP (anciens).
      return [
        {
          kind: 'http',
          method: 'POST',
          url: 'http://4.3.2.1/settings/wifi',
          body: form({ CS0: ssid, CP0: password, CS: ssid, CP: password }),
          contentType: 'application/x-www-form-urlencoded',
        },
      ];
    case 'esphome':
      // À confirmer : portail captif d'ESPHome (« /wifisave », champs ssid / psk).
      return [{ kind: 'http', method: 'GET', url: `http://192.168.4.1/wifisave?${form({ ssid, psk: password })}` }];
    case 'shelly1':
      // À confirmer : Shelly 1re génération, point d'accès en 192.168.33.1.
      return [{ kind: 'http', method: 'GET', url: `http://192.168.33.1/settings/sta?${form({ enabled: '1', ssid, key: password })}` }];
    case 'shelly2':
      // À confirmer : Shelly 2e génération et plus (Plus, Pro), RPC WiFi.SetConfig.
      return [
        {
          kind: 'http',
          method: 'POST',
          url: 'http://192.168.33.1/rpc/WiFi.SetConfig',
          body: JSON.stringify({ config: { sta: { ssid, pass: password, enable: true } } }),
          contentType: 'application/json',
        },
      ];
    case 'magichome':
      // À confirmer : module HF-LPB100 des Magic Home, commandes AT en UDP 48899 (connues de la communauté).
      return [
        {
          kind: 'udp',
          host: '10.10.123.3',
          port: 48899,
          messages: ['HF-A11ASSISTHREAD', '+ok', `AT+WSSSID=${ssid}\r`, `AT+WSKEY=WPA2PSK,AES,${password}\r`, 'AT+WMODE=STA\r', 'AT+Z\r'],
        },
      ];
    case 'closed':
      return [];
  }
}

/**
 * QR code d'un Wi-Fi (« Partager le Wi-Fi » d'Android, étiquette des box) : `WIFI:T:WPA;S:nom;P:mot de passe;;`.
 * Les caractères \ ; , : " sont échappés par une barre oblique inverse.
 */
export function parseWifiQr(text: string): { ssid: string; password: string } | null {
  if (!/^WIFI:/i.test(text.trim())) return null;
  const fields: Record<string, string> = {};
  const body = text.trim().slice(5);
  let key = '';
  let value = '';
  let inValue = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      if (inValue) value += body[++i];
      else key += body[++i];
    } else if (!inValue && c === ':') inValue = true;
    else if (inValue && c === ';') {
      fields[key.toUpperCase()] = value;
      key = '';
      value = '';
      inValue = false;
    } else if (inValue) value += c;
    else key += c;
  }
  if (inValue) fields[key.toUpperCase()] = value;
  return fields.S ? { ssid: fields.S, password: fields.P ?? '' } : null;
}
