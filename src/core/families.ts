/**
 * Les familles de contrôleurs LED connues de l'appli.
 *
 * Une « famille » = une puce et un protocole. Des dizaines de marques et d'applis
 * différentes vendent la même famille sous leur propre nom : c'est tout le problème
 * que l'appli résout.
 */

export type Transport = 'ble' | 'wifi' | 'ir';

export type FamilyId =
  | 'elk-bledom'
  | 'triones'
  | 'zengge-ble'
  | 'sp110e'
  | 'mohuan'
  | 'govee'
  | 'hue-ble'
  | 'magichome-wifi'
  | 'govee-lan'
  | 'wled'
  | 'shelly'
  | 'tasmota'
  | 'esphome'
  | 'yeelight'
  | 'lifx'
  | 'nanoleaf'
  | 'elgato'
  | 'hue-bridge'
  | 'hue'
  | 'tuya'
  | 'ir-nec';

/** Ce que l'appli sait faire elle-même avec la famille (sans l'appli d'origine). */
export interface Capabilities {
  power: boolean;
  color: boolean;
  brightness: boolean;
}

export interface OfficialApp {
  name: string;
  /** Recherche Play Store : les identifiants de paquet de ces applis changent souvent. */
  playQuery: string;
}

export interface Family {
  id: FamilyId;
  label: string;
  transport: Transport;
  /** Les applis d'origine, la plus répandue en premier. */
  apps: OfficialApp[];
  capabilities: Capabilities;
  /** Une phrase pour les développeurs : pourquoi ou comment on la reconnaît. */
  note: string;
  /**
   * Marque connue du public (« Philips Hue », « Govee »…) : affichée telle quelle, elle dit quelque chose à
   * l'utilisateur. Absente pour les contrôleurs sans marque d'AliExpress (on n'affiche jamais le nom de puce).
   */
  brand?: string;
  /** Autorisation à donner une fois sur l'appareil (bouton à presser) avant de pouvoir le piloter. */
  pairing?: 'hue-button' | 'nanoleaf-button';
  /** Système fermé : reconnu, jamais piloté. */
  closed?: boolean;
}

const NONE: Capabilities = { power: false, color: false, brightness: false };
const FULL: Capabilities = { power: true, color: true, brightness: true };

export const FAMILIES: Record<FamilyId, Family> = {
  'elk-bledom': {
    id: 'elk-bledom',
    label: 'ELK-BLEDOM',
    transport: 'ble',
    apps: [
      { name: 'duoCo Strip', playQuery: 'duoCo Strip' },
      { name: 'Lotus Lamp X', playQuery: 'Lotus Lamp X' },
      { name: 'Keepsmile', playQuery: 'Keepsmile' },
      { name: 'Lotus Lantern', playQuery: 'Lotus Lantern' },
    ],
    capabilities: FULL,
    note: 'Contrôleur Bluetooth le plus courant sur AliExpress (noms ELK-BLEDOM, ELK-BLEDOB, MELK…).',
  },
  triones: {
    id: 'triones',
    label: 'Triones',
    transport: 'ble',
    apps: [{ name: 'HappyLighting', playQuery: 'HappyLighting' }],
    capabilities: FULL,
    note: 'Contrôleur Bluetooth Triones / Magic Blue (noms Triones, QHM, LEDBlue, Dream…).',
  },
  'zengge-ble': {
    id: 'zengge-ble',
    label: 'Zengge (Bluetooth)',
    transport: 'ble',
    apps: [
      { name: 'Zengge', playQuery: 'Zengge' },
      { name: 'Magic Home Pro', playQuery: 'Magic Home Pro' },
      { name: 'LED Chord', playQuery: 'LED Chord' },
    ],
    capabilities: FULL,
    note: 'Contrôleur Zengge / Magic Home en Bluetooth (noms LEDnetWF, LEDBLE…).',
  },
  sp110e: {
    id: 'sp110e',
    label: 'SP110E',
    transport: 'ble',
    apps: [
      { name: 'LED Hue', playQuery: 'LED Hue SP110E' },
      { name: 'BanlanX', playQuery: 'BanlanX' },
    ],
    capabilities: FULL,
    note: 'Contrôleur pour rubans adressables (pixels) de la gamme SP1xxE.',
  },
  mohuan: {
    id: 'mohuan',
    label: 'Mohuan (BJ_LED)',
    transport: 'ble',
    apps: [{ name: 'MohuanLED', playQuery: 'MohuanLED' }],
    capabilities: NONE,
    note: 'Contrôleur Bluetooth vendu sous le nom BJ_LED (protocole non documenté).',
  },
  govee: {
    id: 'govee',
    label: 'Govee',
    transport: 'ble',
    apps: [{ name: 'Govee Home', playQuery: 'Govee Home' }],
    capabilities: NONE,
    note: 'Produit Govee vu en Bluetooth (ihoment, Govee, GBK…). Piloté en Wi-Fi si le contrôle local est activé.',
    brand: 'Govee',
  },
  'hue-ble': {
    id: 'hue-ble',
    label: 'Philips Hue (Bluetooth)',
    transport: 'ble',
    apps: [{ name: 'Philips Hue', playQuery: 'Philips Hue' }],
    capabilities: FULL,
    note: 'Lampe Hue récente en Bluetooth (service FE0F de Signify). Demande un appairage Android.',
    brand: 'Philips Hue',
  },
  'magichome-wifi': {
    id: 'magichome-wifi',
    label: 'Magic Home (Wi-Fi)',
    transport: 'wifi',
    apps: [
      { name: 'Magic Home Pro', playQuery: 'Magic Home Pro' },
      { name: 'Zengge', playQuery: 'Zengge' },
    ],
    capabilities: FULL,
    note: 'Contrôleur Wi-Fi Magic Home / Zengge : il a répondu à la sonde du port 48899 ; piloté en TCP 5577.',
    brand: 'Magic Home',
  },
  'govee-lan': {
    id: 'govee-lan',
    label: 'Govee (Wi-Fi)',
    transport: 'wifi',
    apps: [{ name: 'Govee Home', playQuery: 'Govee Home' }],
    capabilities: FULL,
    note: 'Produit Govee dont le contrôle local (LAN) est activé : UDP 4003.',
    brand: 'Govee',
  },
  wled: {
    id: 'wled',
    label: 'WLED',
    transport: 'wifi',
    apps: [{ name: 'WLED', playQuery: 'WLED' }],
    capabilities: FULL,
    note: 'Contrôleur ESP flashé avec WLED (mDNS _wled._tcp, API JSON).',
    brand: 'WLED',
  },
  shelly: {
    id: 'shelly',
    label: 'Shelly',
    transport: 'wifi',
    apps: [{ name: 'Shelly Smart Control', playQuery: 'Shelly Smart Control' }],
    capabilities: FULL,
    note: 'Shelly RGBW2, Duo RGBW, Plus RGBW PM : API HTTP locale.',
    brand: 'Shelly',
  },
  tasmota: {
    id: 'tasmota',
    label: 'Tasmota',
    transport: 'wifi',
    apps: [],
    capabilities: FULL,
    note: 'Micrologiciel libre Tasmota : commandes HTTP /cm.',
    brand: 'Tasmota',
  },
  esphome: {
    id: 'esphome',
    label: 'ESPHome',
    transport: 'wifi',
    apps: [],
    capabilities: FULL,
    note: 'Micrologiciel libre ESPHome avec le serveur web activé (mDNS _esphomelib._tcp).',
    brand: 'ESPHome',
  },
  yeelight: {
    id: 'yeelight',
    label: 'Yeelight',
    transport: 'wifi',
    apps: [{ name: 'Yeelight', playQuery: 'Yeelight' }],
    capabilities: FULL,
    note: 'Yeelight avec « contrôle LAN » activé : découverte UDP 1982, commandes TCP 55443.',
    brand: 'Yeelight',
  },
  lifx: {
    id: 'lifx',
    label: 'LIFX',
    transport: 'wifi',
    apps: [{ name: 'LIFX', playQuery: 'LIFX' }],
    capabilities: FULL,
    note: 'Protocole LAN public de LIFX (UDP 56700).',
    brand: 'LIFX',
  },
  nanoleaf: {
    id: 'nanoleaf',
    label: 'Nanoleaf',
    transport: 'wifi',
    apps: [{ name: 'Nanoleaf', playQuery: 'Nanoleaf' }],
    capabilities: FULL,
    note: 'Open API locale de Nanoleaf (port 16021), jeton obtenu en tenant le bouton marche.',
    brand: 'Nanoleaf',
    pairing: 'nanoleaf-button',
  },
  elgato: {
    id: 'elgato',
    label: 'Elgato',
    transport: 'wifi',
    apps: [{ name: 'Elgato Control Center', playQuery: 'Elgato Control Center' }],
    capabilities: FULL,
    note: 'Elgato Light Strip : API locale (port 9123).',
    brand: 'Elgato',
  },
  'hue-bridge': {
    id: 'hue-bridge',
    label: 'Pont Philips Hue',
    transport: 'wifi',
    apps: [{ name: 'Philips Hue', playQuery: 'Philips Hue' }],
    capabilities: NONE,
    note: 'Pont Hue (mDNS _hue._tcp) : autorisation en appuyant sur son bouton, puis ses lampes apparaissent.',
    brand: 'Philips Hue',
    pairing: 'hue-button',
  },
  hue: {
    id: 'hue',
    label: 'Philips Hue',
    transport: 'wifi',
    apps: [{ name: 'Philips Hue', playQuery: 'Philips Hue' }],
    capabilities: FULL,
    note: 'Lampe reliée à un pont Hue autorisé (API locale v1).',
    brand: 'Philips Hue',
  },
  tuya: {
    id: 'tuya',
    label: 'Tuya',
    transport: 'wifi',
    apps: [
      { name: 'Smart Life', playQuery: 'Smart Life' },
      { name: 'Tuya Smart', playQuery: 'Tuya Smart' },
    ],
    capabilities: NONE,
    note: 'Appareil Tuya : système fermé (la clé de pilotage local ne s’obtient que par un compte cloud Tuya).',
    closed: true,
  },
  'ir-nec': {
    id: 'ir-nec',
    label: 'Télécommande infrarouge',
    transport: 'ir',
    apps: [],
    capabilities: { power: true, color: true, brightness: true },
    note: 'Rubans à télécommande infrarouge 24 ou 44 touches (protocole NEC).',
  },
};

/** Lien Play Store vers la recherche de l'appli d'origine. */
export function playStoreUrl(app: OfficialApp): string {
  return `https://play.google.com/store/search?q=${encodeURIComponent(app.playQuery)}&c=apps`;
}
