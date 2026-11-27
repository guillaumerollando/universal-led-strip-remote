/**
 * Infrarouge : protocole NEC et télécommandes standard des rubans LED.
 *
 * Presque tous les rubans à télécommande vendus sur AliExpress utilisent l'une des deux
 * télécommandes génériques (24 ou 44 touches), en NEC sur une porteuse de 38 kHz.
 */

import type { Rgb } from './elk';

export const NEC_CARRIER_HZ = 38000;

const HEADER_MARK = 9000;
const HEADER_SPACE = 4500;
// Impulsions allongées à 600 µs (au lieu des 562 théoriques), comme IReDroid (testé sur Xiaomi) : l'émetteur MediaTek du
// Redmi arrondit les durées à la période de la porteuse (562 → 552 µs) et n'allume la LED qu'un tiers du temps ; des
// impulsions trop courtes et faibles sont ratées par les récepteurs bas de gamme. Les espaces compensent (550 / 1650 µs).
const BIT_MARK = 600;
const ZERO_SPACE = 550;
const ONE_SPACE = 1650;
/** Une trame NEC dure 108 ms d'un début à l'autre. */
const FRAME_US = 108000;

/**
 * Construit le motif marche/arrêt (en µs) d'une trame NEC, pour `ConsumerIrManager.transmit`.
 * @param address les deux octets d'adresse tels qu'émis : `[adr, ~adr]` en NEC classique, ou deux octets en NEC étendu
 * @param command l'octet de commande ; son complément est ajouté automatiquement
 */
export function necPattern(address: readonly [number, number], command: number): number[] {
  const bytes = [address[0] & 0xff, address[1] & 0xff, command & 0xff, ~command & 0xff];
  const pattern = [HEADER_MARK, HEADER_SPACE];
  for (const value of bytes) {
    for (let bit = 0; bit < 8; bit++) {
      // NEC émet le bit de poids faible en premier.
      pattern.push(BIT_MARK, (value >> bit) & 1 ? ONE_SPACE : ZERO_SPACE);
    }
  }
  pattern.push(BIT_MARK);
  return pattern;
}

/** Durée totale d'un motif, en µs. */
export function patternDuration(pattern: readonly number[]): number {
  return pattern.reduce((sum, d) => sum + d, 0);
}

// ── Envoi fiable sur l'émetteur MediaTek (HAL IRTX, pilote mtk_irtx_pwm) ──
// Observé chez Guillaume (Redmi Note 14 Pro+, 2026-10-08) : les envois de plusieurs trames d'un coup font réagir les rubans,
// une trame seule par appel presque jamais. Le pilote coupe l'émetteur au bout de la durée calculée et peut tronquer la fin
// du motif : avec une trame seule, c'est la fin du code (octet de contrôle, bit d'arrêt) qui saute. On termine donc chaque
// envoi par une « queue » sans conséquence — des codes « touche maintenue », que le récepteur ignore — qui, elle, peut être
// tronquée sans dommage.

/** Limite d'Android pour un appel à transmit(). */
export const ANDROID_MAX_US = 2_000_000;

/** Code « touche maintenue » du protocole NEC. */
export const NEC_REPEAT: readonly number[] = [HEADER_MARK, 2250, BIT_MARK];

/** Ajoute la queue protectrice : silence jusqu'à 108 ms, « touche maintenue », silence, « touche maintenue ». */
export function withTail(pattern: readonly number[]): number[] {
  const repeat = NEC_REPEAT;
  const toNext = (p: readonly number[]): number => Math.max(FRAME_US - patternDuration(p), 10000);
  return [...pattern, toNext(pattern.slice(-67)), ...repeat, toNext(repeat), ...repeat];
}

/** Un motif est-il acceptable pour Android (longueur impaire, durées positives, moins de 2 s) ? */
export function fitsAndroid(pattern: readonly number[]): boolean {
  return pattern.length % 2 === 1 && pattern.every((d) => d > 0) && patternDuration(pattern) < ANDROID_MAX_US;
}

/** Un appui sur une touche, en UN appel : la trame puis la queue (« touche maintenue » ×2), comme une vraie télécommande. */
export function pressPattern(address: readonly [number, number], command: number): number[] {
  return withTail(necPattern(address, command));
}

/** Une rafale de codes en UN appel (au plus 15 pour rester sous 2 s), terminée par la queue protectrice. */
export function burstPattern(candidates: IrCandidate[]): number[] {
  return withTail(batchPattern(candidates));
}

// ── Télécommandes ────────────────────────────────────────────────────────

export type IrKeyKind = 'power-on' | 'power-off' | 'power-toggle' | 'brighter' | 'dimmer' | 'color' | 'effect';

export interface IrKey {
  id: string;
  label: string;
  command: number;
  kind: IrKeyKind;
  /** Couleur de la pastille pour les touches de couleur. */
  rgb?: Rgb;
}

type BaseRemoteId = 'nec24' | 'nec24ff' | 'nec44' | 'bulb24' | 'sylvania24' | 'mp3-21' | 'jelly' | 'strip82' | 'monster' | 'ove' | 'idual';
/** Une télécommande connue, ou la 44 touches complétée par les ON / OFF séparés d'une autre (`nec44+bulb24`). */
export type IrRemoteId = BaseRemoteId | `nec44+${BaseRemoteId}`;

export interface IrRemote {
  id: IrRemoteId;
  label: string;
  address: readonly [number, number];
  /** Nombre de touches par rangée, pour dessiner la télécommande comme l'originale. */
  columns: number;
  keys: IrKey[];
}

const c = (id: string, label: string, command: number, r: number, g: number, b: number): IrKey => ({
  id,
  label,
  command,
  kind: 'color',
  rgb: { r, g, b },
});
const fx = (id: string, label: string, command: number): IrKey => ({ id, label, command, kind: 'effect' });

/**
 * Télécommande 24 touches (adresse NEC étendue 0xEF00 : octets émis 00 EF).
 * La commande est le numéro de la touche, ligne par ligne (codes « F7xxxx » des tables Arduino).
 */
export const REMOTE_24: IrRemote = {
  id: 'nec24',
  label: '24 touches',
  address: [0x00, 0xef],
  columns: 4,
  keys: [
    { id: 'up', label: 'Plus fort', command: 0x00, kind: 'brighter' },
    { id: 'down', label: 'Moins fort', command: 0x01, kind: 'dimmer' },
    { id: 'off', label: 'Éteindre', command: 0x02, kind: 'power-off' },
    { id: 'on', label: 'Allumer', command: 0x03, kind: 'power-on' },
    c('r', 'Rouge', 0x04, 255, 0, 0),
    c('g', 'Vert', 0x05, 0, 255, 0),
    c('b', 'Bleu', 0x06, 0, 0, 255),
    c('w', 'Blanc', 0x07, 255, 255, 255),
    c('r2', 'Orange foncé', 0x08, 255, 64, 0),
    c('g2', 'Vert clair', 0x09, 64, 255, 64),
    c('b2', 'Bleu clair', 0x0a, 64, 64, 255),
    fx('flash', 'Flash', 0x0b),
    c('r3', 'Orange', 0x0c, 255, 128, 0),
    c('g3', 'Cyan', 0x0d, 0, 255, 255),
    c('b3', 'Violet', 0x0e, 128, 0, 255),
    fx('strobe', 'Stroboscope', 0x0f),
    c('r4', 'Ambre', 0x10, 255, 176, 0),
    c('g4', 'Bleu-vert', 0x11, 0, 192, 192),
    c('b4', 'Mauve', 0x12, 160, 0, 192),
    fx('fade', 'Fondu', 0x13),
    c('r5', 'Jaune', 0x14, 255, 255, 0),
    c('g5', 'Bleu ciel', 0x15, 0, 128, 255),
    c('b5', 'Rose', 0x16, 255, 0, 160),
    fx('smooth', 'Doux', 0x17),
  ],
};

/**
 * Télécommande 44 touches (NEC classique, adresse 0x00 : octets émis 00 FF).
 * Codes déduits des tables « FFxxxx » de la communauté Arduino, à confirmer sur les rubans.
 */
export const REMOTE_44: IrRemote = {
  id: 'nec44',
  label: '44 touches',
  address: [0x00, 0xff],
  columns: 4,
  keys: [
    { id: 'up', label: 'Plus fort', command: 0x5c, kind: 'brighter' },
    { id: 'down', label: 'Moins fort', command: 0x5d, kind: 'dimmer' },
    fx('play', 'Lecture', 0x41),
    { id: 'power', label: 'Marche/arrêt', command: 0x40, kind: 'power-toggle' },
    c('r', 'Rouge', 0x58, 255, 0, 0),
    c('g', 'Vert', 0x59, 0, 255, 0),
    c('b', 'Bleu', 0x45, 0, 0, 255),
    c('w', 'Blanc', 0x44, 255, 255, 255),
    c('r2', 'Orange foncé', 0x54, 255, 64, 0),
    c('g2', 'Vert clair', 0x55, 64, 255, 64),
    c('b2', 'Bleu clair', 0x49, 64, 64, 255),
    c('w2', 'Rose pâle', 0x48, 255, 192, 203),
    c('r3', 'Orange', 0x50, 255, 128, 0),
    c('g3', 'Cyan', 0x51, 0, 255, 255),
    c('b3', 'Violet', 0x4d, 128, 0, 255),
    c('w3', 'Rose', 0x4c, 255, 160, 180),
    c('r4', 'Ambre', 0x1c, 255, 176, 0),
    c('g4', 'Bleu-vert', 0x1d, 0, 192, 192),
    c('b4', 'Mauve', 0x1e, 160, 0, 192),
    c('w4', 'Bleu pâle', 0x1f, 180, 200, 255),
    c('r5', 'Jaune', 0x18, 255, 255, 0),
    c('g5', 'Bleu ciel', 0x19, 0, 128, 255),
    c('b5', 'Magenta', 0x1a, 255, 0, 160),
    c('w5', 'Bleu glacier', 0x1b, 200, 230, 255),
    fx('r-up', 'Rouge +', 0x14),
    fx('g-up', 'Vert +', 0x15),
    fx('b-up', 'Bleu +', 0x16),
    fx('quick', 'Plus vite', 0x17),
    fx('r-down', 'Rouge −', 0x10),
    fx('g-down', 'Vert −', 0x11),
    fx('b-down', 'Bleu −', 0x12),
    fx('slow', 'Moins vite', 0x13),
    fx('diy1', 'Perso 1', 0x0c),
    fx('diy2', 'Perso 2', 0x0d),
    fx('diy3', 'Perso 3', 0x0e),
    fx('auto', 'Auto', 0x0f),
    fx('diy4', 'Perso 4', 0x08),
    fx('diy5', 'Perso 5', 0x09),
    fx('diy6', 'Perso 6', 0x0a),
    fx('flash', 'Flash', 0x0b),
    fx('jump3', 'Saut 3', 0x04),
    fx('jump7', 'Saut 7', 0x05),
    fx('fade3', 'Fondu 3', 0x06),
    fx('fade7', 'Fondu 7', 0x07),
  ],
};

/**
 * Télécommande 24 touches, variante à l'adresse 00 FF (codes « FF8877 » allumer, « FFA857 » éteindre…),
 * donnée par Guillaume le 2026-10-08. Les touches d'effets de cette variante ne sont pas connues.
 */
export const REMOTE_24_FF: IrRemote = {
  id: 'nec24ff',
  label: '24 touches (variante FF)',
  address: [0x00, 0xff],
  columns: 4,
  keys: [
    { id: 'up', label: 'Plus fort', command: 0x1c, kind: 'brighter' },
    { id: 'down', label: 'Moins fort', command: 0x1d, kind: 'dimmer' },
    { id: 'off', label: 'Éteindre', command: 0x15, kind: 'power-off' },
    { id: 'on', label: 'Allumer', command: 0x11, kind: 'power-on' },
    c('r', 'Rouge', 0x18, 255, 0, 0),
    c('g', 'Vert', 0x19, 0, 255, 0),
    c('b', 'Bleu', 0x1a, 0, 0, 255),
    c('w', 'Blanc', 0x1b, 255, 255, 255),
  ],
};

/** Télécommande dont on ne connaît que marche et arrêt (tables Flipper-IRDB, dossier LED_Lighting). */
const onOff = (id: BaseRemoteId, label: string, address: readonly [number, number], on: number, off: number): IrRemote => ({
  id,
  label,
  address,
  columns: 2,
  keys: [
    { id: 'on', label: 'Allumer', command: on, kind: 'power-on' },
    { id: 'off', label: 'Éteindre', command: off, kind: 'power-off' },
  ],
});

/**
 * Toutes les télécommandes connues, de la plus répandue à la plus rare.
 * Les cinq dernières viennent de Flipper-IRDB (LED_Lighting) ; seules leurs touches marche/arrêt sont connues.
 */
export const IR_REMOTES: IrRemote[] = [
  REMOTE_24,
  REMOTE_24_FF,
  REMOTE_44,
  onOff('bulb24', '24 touches (ampoule)', [0x00, 0xff], 0x07, 0x06),
  onOff('sylvania24', '24 touches (Sylvania)', [0x00, 0xff], 0x0d, 0x1f),
  onOff('mp3-21', '17 / 21 touches', [0x00, 0xff], 0x45, 0x47),
  onOff('jelly', '24 touches (lampe)', [0x00, 0xff], 0x05, 0x04),
  onOff('strip82', '24 touches (ruban 8x)', [0x00, 0xff], 0x83, 0x82),
  onOff('monster', '24 touches (Monster)', [0x00, 0xef], 0x00, 0x01),
  onOff('ove', 'Ove', [0x02, 0xfd], 0x00, 0x02),
  onOff('idual', 'iDual', [0x02, 0xfe], 0x01, 0x02),
];

/**
 * Combine les couleurs et effets de la 44 touches avec les ON / OFF séparés d'une autre télécommande de même adresse :
 * beaucoup de contrôleurs comprennent les deux jeux de codes (cas du néon 220 V de Guillaume, 2026-10-08).
 */
export function withSeparatePower(power: IrRemote): IrRemote | null {
  const sameAddress = power.address[0] === REMOTE_44.address[0] && power.address[1] === REMOTE_44.address[1];
  const on = power.keys.find((k) => k.kind === 'power-on');
  const off = power.keys.find((k) => k.kind === 'power-off');
  if (!sameAddress || !on || !off || power.id === 'nec44' || power.id.startsWith('nec44+')) return null;
  return {
    id: `nec44+${power.id as BaseRemoteId}`,
    label: '44 touches + ON / OFF séparés',
    address: REMOTE_44.address,
    columns: 4,
    keys: [
      { ...REMOTE_44.keys[0] },
      { ...REMOTE_44.keys[1] },
      { ...off, label: 'Éteindre' },
      { ...on, label: 'Allumer' },
      ...REMOTE_44.keys.slice(4),
    ],
  };
}

export function remoteById(id: IrRemoteId): IrRemote {
  if (id.startsWith('nec44+')) {
    const power = IR_REMOTES.find((r) => r.id === id.slice(6));
    const combo = power && withSeparatePower(power);
    if (combo) return combo;
  }
  return IR_REMOTES.find((r) => r.id === id) ?? REMOTE_24;
}

// ── Rafales de codes ─────────────────────────────────────────────────────

export interface IrCandidate {
  address: readonly [number, number];
  command: number;
}

/** Motif qui enchaîne plusieurs codes (moins de 2 s au total, limite d'Android). */
export function batchPattern(candidates: IrCandidate[]): number[] {
  const out: number[] = [];
  candidates.forEach((cand, i) => {
    const frame = necPattern(cand.address, cand.command);
    out.push(...frame);
    if (i < candidates.length - 1) out.push(Math.max(FRAME_US - patternDuration(frame), 10000));
  });
  return out;
}
