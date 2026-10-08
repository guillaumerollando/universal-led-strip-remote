import type { ElkModel } from './elk';
import type { FamilyId, Transport } from './families';

export type Confidence = 'sure' | 'probable';

/** Un appareil vu pendant un scan, déjà rattaché à une famille. */
export interface DetectedDevice {
  /** Clé stable : `ble:<adresse>` ou `wifi:<mac ou ip>`. */
  key: string;
  family: FamilyId;
  confidence: Confidence;
  transport: Transport;
  /** Nom annoncé par l'appareil (Bluetooth) ou modèle (Wi-Fi). */
  rawName: string;
  /** Adresse Bluetooth ou IP. */
  address: string;
  rssi?: number;
  /** Modèle exact quand l'appareil le donne (ex. variante ELK, version du protocole Tuya). */
  model?: string;
  /** Identifiant Tuya (gwId), lu dans l'annonce UDP. */
  tuyaId?: string;
}

/** Ce que le scanner Bluetooth nous donne d'une annonce. */
export interface BleAdvert {
  id: string;
  name: string | null;
  serviceUUIDs?: string[] | null;
  rssi?: number | null;
}

interface NameRule {
  family: FamilyId;
  pattern: RegExp;
  confidence: Confidence;
}

/**
 * Règles par nom Bluetooth, de la plus précise à la plus vague.
 * Sources : intégrations Home Assistant (led_ble, elkbledom, ha-triones, SP110E-HASS)
 * et appareils vus chez Guillaume (ELK-BLEDOB, « MELK-OA21   92 »).
 */
const NAME_RULES: NameRule[] = [
  { family: 'elk-bledom', pattern: /^(ELK-|MELK|ELK_)/i, confidence: 'sure' },
  { family: 'triones', pattern: /^(Triones|QHM-|LEDBlue|Dream~|Flash)/i, confidence: 'sure' },
  { family: 'zengge-ble', pattern: /^(LEDnet|ZENGGE)/i, confidence: 'sure' },
  { family: 'zengge-ble', pattern: /^(LEDBLE|BLE-LED|AP-)/i, confidence: 'probable' },
  { family: 'sp110e', pattern: /^SP\d{3}E/i, confidence: 'sure' },
  { family: 'mohuan', pattern: /^BJ_LED/i, confidence: 'sure' },
  { family: 'govee', pattern: /^(ihoment_|Govee_|GBK_|Minger_)/i, confidence: 'sure' },
];

/** Préfixe de nom → variante de protocole ELK (voir `elk.ts`). */
export function elkModel(name: string): ElkModel {
  if (/^MELK/i.test(name)) return 'melk';
  if (/^ELK-BLEDOB|^ELK-BLEDOM0E/i.test(name)) return 'bledob';
  return 'elk';
}

/** Rattache une annonce Bluetooth à une famille connue, ou `null` si ce n'est pas un contrôleur LED connu. */
export function identifyBle(adv: BleAdvert): DetectedDevice | null {
  const name = adv.name?.trim();
  if (!name) return null;
  const rule = NAME_RULES.find((r) => r.pattern.test(name));
  if (!rule) return null;
  return {
    key: `ble:${adv.id}`,
    family: rule.family,
    confidence: rule.confidence,
    transport: 'ble',
    rawName: name,
    address: adv.id,
    rssi: adv.rssi ?? undefined,
    model: rule.family === 'elk-bledom' ? elkModel(name) : undefined,
  };
}

// ── Wi-Fi ────────────────────────────────────────────────────────────────

/** Message envoyé en broadcast UDP 48899 ; les contrôleurs Magic Home répondent « ip,mac,modèle ». */
export const MAGIC_HOME_PROBE = 'HF-A11ASSISTHREAD';
export const MAGIC_HOME_PORT = 48899;
/** Ports où les appareils Tuya s'annoncent d'eux-mêmes toutes les ~5 s. */
export const TUYA_PORTS = [6666, 6667, 7000] as const;
/** Govee : requête multicast sur 4001, réponses sur 4002 (si le contrôle LAN est activé dans Govee Home). */
export const GOVEE_MULTICAST = '239.255.255.250';
export const GOVEE_SCAN_PORT = 4001;
export const GOVEE_REPLY_PORT = 4002;
export const GOVEE_PROBE = JSON.stringify({ msg: { cmd: 'scan', data: { account_topic: 'reserve' } } });

/** Lit la réponse d'un contrôleur Magic Home, ex. `192.168.1.20,ACCF23A1B2C3,AK001-ZJ2101`. */
export function parseMagicHomeReply(text: string, fromIp: string): DetectedDevice | null {
  if (text === MAGIC_HOME_PROBE) return null;
  const [ip, mac, model] = text.trim().split(',');
  if (!ip || !mac || !/^[0-9A-F]{12}$/i.test(mac)) return null;
  return {
    key: `wifi:${mac.toUpperCase()}`,
    family: 'magichome-wifi',
    confidence: 'sure',
    transport: 'wifi',
    rawName: model || 'Magic Home',
    address: ip || fromIp,
    model,
  };
}

/**
 * Annonce d'un appareil Tuya (ports 6666 / 6667 / 7000). Quand elle est déchiffrée, on connaît l'identifiant
 * de l'appareil et sa version de protocole ; sinon on garde au moins son IP.
 */
export function tuyaFromBroadcast(fromIp: string, info?: { gwId: string; ip: string; version?: string; productKey?: string } | null): DetectedDevice {
  return {
    key: info ? `tuya:${info.gwId}` : `wifi:${fromIp}`,
    family: 'tuya',
    confidence: 'sure',
    transport: 'wifi',
    rawName: 'Appareil Tuya',
    address: info?.ip ?? fromIp,
    model: info?.version,
    tuyaId: info?.gwId,
  };
}

/** Lit la réponse JSON d'un appareil Govee au scan LAN. */
export function parseGoveeReply(text: string, fromIp: string): DetectedDevice | null {
  try {
    const data = (JSON.parse(text) as { msg?: { cmd?: string; data?: { ip?: string; device?: string; sku?: string } } })
      .msg?.data;
    if (!data?.device) return null;
    return {
      key: `wifi:${data.device}`,
      family: 'govee',
      confidence: 'sure',
      transport: 'wifi',
      rawName: data.sku ? `Govee ${data.sku}` : 'Govee',
      address: data.ip ?? fromIp,
      model: data.sku,
    };
  } catch {
    return null;
  }
}
