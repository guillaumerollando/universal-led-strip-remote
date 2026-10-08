/**
 * Trames Tuya, seulement ce qu'il faut pour **reconnaître** un appareil Tuya pendant la recherche (ses annonces UDP).
 * Rubanix ne pilote pas Tuya : système fermé, clé secrète par appareil donnée par le cloud Tuya (ADR-005, ADR-008).
 * Format traduit de tinytuya (core/message_helper.py, udp_helper.py) ; trames vérifiées octet pour octet contre tinytuya.
 * Le pilotage local complet (3.3 / 3.4 / 3.5) a été écrit puis retiré le 2026-10-08 : voir l'historique et le vault (tuya-spec).
 */

import { ecb, gcm } from '@noble/ciphers/aes.js';
import { hmac } from '@noble/hashes/hmac.js';
import { md5 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { ascii, concat, crc32, equal, fromUtf8, readU32, u16, u32 } from './bytes';


const PREFIX_55AA = 0x000055aa;
const SUFFIX_55AA = 0x0000aa55;
const PREFIX_6699 = 0x00006699;
const SUFFIX_6699 = 0x00009966;

/** Clé de chiffrement des diffusions UDP : md5("yGAdlopoPVldABfn"). */
export const UDP_KEY = md5(ascii('yGAdlopoPVldABfn'));

export interface Frame {
  seq: number;
  cmd: number;
  /** Code retour (trames reçues seulement). */
  retcode?: number;
  /** Charge utile après vérification (et après déchiffrement GCM en 3.5). */
  payload: Uint8Array;
}

// ── Construction ─────────────────────────────────────────────────────────

/** Trame 55AA (3.1 à 3.4) : CRC32 si `hmacKey` est absent, sinon HMAC-SHA256. */
export function pack55AA(seq: number, cmd: number, payload: Uint8Array, hmacKey?: Uint8Array): Uint8Array {
  const checkLen = hmacKey ? 32 : 4;
  const head = concat(u32(PREFIX_55AA), u32(seq), u32(cmd), u32(payload.length + checkLen + 4));
  const pre = concat(head, payload);
  const check = hmacKey ? hmac(sha256, hmacKey, pre) : u32(crc32(pre));
  return concat(pre, check, u32(SUFFIX_55AA));
}

/** Trame 6699 (3.5) : AES-GCM, l'en-tête sert de données authentifiées. */
export function pack6699(seq: number, cmd: number, plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const len = 12 + plaintext.length + 16;
  const head = concat(u32(PREFIX_6699), u16(0), u32(seq), u32(cmd), u32(len));
  const sealed = gcm(key, iv, head.slice(4)).encrypt(plaintext);
  return concat(head, iv, sealed, u32(SUFFIX_6699));
}


// ── Lecture ──────────────────────────────────────────────────────────────

/** Taille totale de la trame qui commence au début de `buf`, ou `null` si l'en-tête est incomplet. */
export function frameLength(buf: Uint8Array): number | null {
  if (buf.length < 4) return null;
  const prefix = readU32(buf, 0);
  if (prefix === PREFIX_55AA) return buf.length < 16 ? null : 16 + readU32(buf, 12);
  if (prefix === PREFIX_6699) return buf.length < 18 ? null : 18 + readU32(buf, 14) + 4;
  throw new Error('Trame Tuya illisible');
}

/** Découpe et vérifie une trame reçue (CRC, HMAC ou tag GCM). */
export function unpackFrame(data: Uint8Array, key?: Uint8Array, opts: { hmac?: boolean; hasRetcode?: boolean } = {}): Frame {
  const hasRetcode = opts.hasRetcode ?? true;
  const prefix = readU32(data, 0);
  if (prefix === PREFIX_55AA) {
    const seq = readU32(data, 4);
    const cmd = readU32(data, 8);
    const len = readU32(data, 12);
    const checkLen = opts.hmac ? 32 : 4;
    const end = 16 + len - (checkLen + 4);
    const covered = data.slice(0, end);
    const check = data.slice(end, end + checkLen);
    if (opts.hmac) {
      if (!key || !equal(hmac(sha256, key, covered), check)) throw new Error('HMAC Tuya invalide (mauvaise clé ou version ?)');
    } else if (readU32(check, 0) !== crc32(covered)) {
      throw new Error('CRC Tuya invalide');
    }
    const retcode = hasRetcode ? readU32(data, 16) : undefined;
    return { seq, cmd, retcode, payload: data.slice(hasRetcode ? 20 : 16, end) };
  }
  if (prefix === PREFIX_6699) {
    if (!key) throw new Error('Clé manquante pour une trame 3.5');
    const head = data.slice(0, 18);
    const seq = readU32(data, 6);
    const cmd = readU32(data, 10);
    const len = readU32(data, 14);
    const iv = data.slice(18, 30);
    const sealed = data.slice(30, 18 + len);
    let plain = gcm(key, iv, head.slice(4)).decrypt(sealed);
    let retcode: number | undefined;
    if (hasRetcode && plain.length >= 4 && plain[0] !== 0x7b) {
      retcode = readU32(plain, 0);
      plain = plain.slice(4);
    }
    return { seq, cmd, retcode, payload: plain };
  }
  throw new Error('Trame Tuya illisible');
}



// ── Découverte UDP ───────────────────────────────────────────────────────

export interface TuyaBroadcast {
  ip: string;
  gwId: string;
  version?: string;
  productKey?: string;
}

/** Déchiffre une annonce UDP (ports 6666 / 6667 / 7000). */
export function decodeBroadcast(data: Uint8Array): TuyaBroadcast | null {
  try {
    const prefix = readU32(data, 0);
    let text: string;
    if (prefix === PREFIX_6699) {
      text = fromUtf8(unpackFrame(data, UDP_KEY).payload);
    } else {
      const { payload } = unpackFrame(data, undefined, { hasRetcode: true });
      text = payload[0] === 0x7b ? fromUtf8(payload) : fromUtf8(ecb(UDP_KEY).decrypt(payload));
    }
    const json = JSON.parse(text.replace(/\0+$/, '')) as TuyaBroadcast;
    return json.gwId && json.ip ? json : null;
  } catch {
    return null;
  }
}
