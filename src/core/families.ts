/**
 * Les familles de contrôleurs LED connues de Rubanix.
 *
 * Une « famille » = une puce et un protocole. Des dizaines de marques et d'applis
 * différentes vendent la même famille sous leur propre nom : c'est tout le problème
 * que Rubanix résout.
 */

export type Transport = 'ble' | 'wifi' | 'ir';

export type FamilyId =
  | 'elk-bledom'
  | 'triones'
  | 'zengge-ble'
  | 'sp110e'
  | 'mohuan'
  | 'govee'
  | 'magichome-wifi'
  | 'tuya'
  | 'wled'
  | 'ir-nec';

/** Ce que Rubanix sait faire lui-même avec la famille (sans l'appli d'origine). */
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
  /** Une phrase pour l'utilisateur : pourquoi ou comment on la reconnaît. */
  note: string;
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
    capabilities: NONE,
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
    capabilities: NONE,
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
    capabilities: NONE,
    note: 'Contrôleur pour rubans adressables (pixels) de la gamme SP1xxE.',
  },
  mohuan: {
    id: 'mohuan',
    label: 'Mohuan (BJ_LED)',
    transport: 'ble',
    apps: [{ name: 'MohuanLED', playQuery: 'MohuanLED' }],
    capabilities: NONE,
    note: 'Contrôleur Bluetooth vendu sous le nom BJ_LED.',
  },
  govee: {
    id: 'govee',
    label: 'Govee',
    transport: 'ble',
    apps: [{ name: 'Govee Home', playQuery: 'Govee Home' }],
    capabilities: NONE,
    note: 'Produit Govee (noms ihoment, Govee, GBK…).',
  },
  'magichome-wifi': {
    id: 'magichome-wifi',
    label: 'Magic Home (Wi-Fi)',
    transport: 'wifi',
    apps: [
      { name: 'Magic Home Pro', playQuery: 'Magic Home Pro' },
      { name: 'Zengge', playQuery: 'Zengge' },
    ],
    capabilities: NONE,
    note: 'Contrôleur Wi-Fi Magic Home / Zengge : il a répondu à la sonde du port 48899.',
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
    note: 'Appareil Tuya : des centaines de marques revendent Smart Life sous leur propre nom.',
  },
  wled: {
    id: 'wled',
    label: 'WLED',
    transport: 'wifi',
    apps: [{ name: 'WLED', playQuery: 'WLED' }],
    capabilities: NONE,
    note: 'Contrôleur ESP flashé avec WLED.',
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
