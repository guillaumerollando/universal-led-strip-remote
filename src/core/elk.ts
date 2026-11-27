/**
 * Protocole des contrôleurs Bluetooth ELK-BLEDOM (duoCo Strip, Lotus Lamp, Keepsmile…).
 *
 * Trames de 9 octets `7e .. .. .. .. .. .. .. ef` écrites sans réponse sur la caractéristique FFF3
 * du service FFF0. Ces contrôleurs ne renvoient pas leur état (essai du 2026-10-08 sur MELK-OA21 :
 * aucune notification sur FFF4 ; la lecture de FFF3 donne l'identifiant de firmware « P30V32_SHY_R1510 »).
 *
 * Variantes (d'après l'intégration Home Assistant « elkbledom », models.json) :
 * - `elk`    : ELK-BLEDOM et compagnie, 2ᵉ octet à 00 ;
 * - `bledob` : ELK-BLEDOB / BLEDOM0E ;
 * - `melk`   : MELK-…, deux trames d'initialisation après connexion.
 *
 * MELK-OA21 chez Guillaume : marche/arrêt vérifiés le 2026-10-07, et « Bluetooth impeccable » au premier essai de l'appli
 * le 2026-10-08 (couleurs, luminosité). Variante `bledob` et effets : à confirmer.
 */

export type ElkModel = 'elk' | 'bledob' | 'melk';

export const ELK_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
export const ELK_WRITE_CHAR = '0000fff3-0000-1000-8000-00805f9b34fb';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const byte = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const pct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Trames à envoyer juste après la connexion. MELK : la seconde trame d'ouverture **éteint** le ruban (elkbledom renvoie
 * « allumer » juste après) ; sans ça, une ambiance choisie après une reconnexion laissait le ruban éteint ou figé
 * (vu par Guillaume, 2026-11-27).
 */
export function elkInit(model: ElkModel): number[][] {
  return model === 'melk' ? [[0x7e, 0x07, 0x83], [0x7e, 0x04, 0x04], elkPower('melk', true)] : [];
}

export function elkPower(model: ElkModel, on: boolean): number[] {
  switch (model) {
    case 'melk':
      return on ? [0x7e, 0x04, 0x04, 0xf0, 0x00, 0x01, 0xff, 0x00, 0xef] : [0x7e, 0x04, 0x04, 0x00, 0x00, 0x00, 0xff, 0x00, 0xef];
    case 'bledob':
      return on ? [0x7e, 0x07, 0x04, 0xff, 0x00, 0x01, 0x02, 0x01, 0xef] : [0x7e, 0x07, 0x04, 0x00, 0x00, 0x00, 0x02, 0x01, 0xef];
    default:
      return on ? [0x7e, 0x00, 0x04, 0xf0, 0x00, 0x01, 0xff, 0x00, 0xef] : [0x7e, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0x00, 0xef];
  }
}

export function elkColor(model: ElkModel, { r, g, b }: Rgb): number[] {
  return model === 'elk'
    ? [0x7e, 0x00, 0x05, 0x03, byte(r), byte(g), byte(b), 0x00, 0xef]
    : [0x7e, 0x07, 0x05, 0x03, byte(r), byte(g), byte(b), 0x10, 0xef];
}

/** Luminosité de 0 à 100 %. */
export function elkBrightness(model: ElkModel, percent: number): number[] {
  const p = pct(percent);
  return model === 'elk' ? [0x7e, 0x00, 0x01, p, 0x00, 0x00, 0x00, 0x00, 0xef] : [0x7e, 0x04, 0x01, p, 0x01, 0xff, 0x02, 0x01, 0xef];
}

// ── Effets ───────────────────────────────────────────────────────────────

export interface ElkEffect {
  id: string;
  label: string;
  code: number;
  /** Couleurs de l'aperçu animé dans l'appli. */
  preview: Rgb[];
}

const R = { r: 255, g: 0, b: 0 };
const G = { r: 0, g: 255, b: 0 };
const B = { r: 0, g: 0, b: 255 };
const Y = { r: 255, g: 220, b: 0 };
const C = { r: 0, g: 230, b: 255 };
const M = { r: 255, g: 0, b: 200 };
const W = { r: 255, g: 255, b: 255 };
const O = { r: 255, g: 100, b: 0 };
const RAINBOW = [R, O, Y, G, C, B, M];

/** Effets intégrés des ELK-BLEDOM classiques (codes 0x87 à 0x9c). */
const CLASSIC_EFFECTS: ElkEffect[] = [
  { id: 'jump7', label: 'Saut 7 couleurs', code: 0x88, preview: RAINBOW },
  { id: 'jump3', label: 'Saut RVB', code: 0x87, preview: [R, G, B] },
  { id: 'fade7', label: 'Fondu 7 couleurs', code: 0x8a, preview: RAINBOW },
  { id: 'fade3', label: 'Fondu RVB', code: 0x89, preview: [R, G, B] },
  { id: 'fade-red', label: 'Respiration rouge', code: 0x8b, preview: [R, { r: 40, g: 0, b: 0 }] },
  { id: 'fade-blue', label: 'Respiration bleue', code: 0x8d, preview: [B, { r: 0, g: 0, b: 40 }] },
  { id: 'fade-white', label: 'Respiration blanche', code: 0x91, preview: [W, { r: 40, g: 40, b: 40 }] },
  { id: 'fade-rg', label: 'Fondu rouge-vert', code: 0x92, preview: [R, G] },
  { id: 'fade-rb', label: 'Fondu rouge-bleu', code: 0x93, preview: [R, B] },
  { id: 'blink7', label: 'Clignote 7 couleurs', code: 0x95, preview: RAINBOW },
  { id: 'blink-white', label: 'Clignote blanc', code: 0x9c, preview: [W, { r: 0, g: 0, b: 0 }] },
];

/**
 * Effets des MELK (catalogue « STRIPX » de elkbledom, identifiants 1 à 220 regroupés par famille) :
 * on en garde un représentant par famille. À confirmer à l'œil sur le MELK-OA21.
 */
const MELK_EFFECTS: ElkEffect[] = [
  { id: 'rainbow', label: 'Arc-en-ciel', code: 1, preview: RAINBOW },
  { id: 'chase', label: 'Poursuite', code: 3, preview: [R, { r: 0, g: 0, b: 0 }, B] },
  { id: 'chase-pulse', label: 'Poursuite pulsée', code: 11, preview: [M, { r: 0, g: 0, b: 0 }, C] },
  { id: 'chase-flow', label: 'Flot', code: 23, preview: [B, C, G] },
  { id: 'pulse', label: 'Flash', code: 53, preview: [W, { r: 0, g: 0, b: 0 }] },
  { id: 'curtain', label: 'Rideau', code: 55, preview: [Y, O, R] },
  { id: 'fire', label: 'Feu', code: 61, preview: [R, O, Y] },
  { id: 'fade', label: 'Fondu', code: 74, preview: RAINBOW },
];

export function elkEffects(model: ElkModel): ElkEffect[] {
  return model === 'melk' ? MELK_EFFECTS : CLASSIC_EFFECTS;
}

export function elkEffect(model: ElkModel, code: number): number[] {
  return model === 'melk'
    ? [0x7e, 0x05, 0x03, byte(code), 0x06, 0xff, 0xff, 0x00, 0xef]
    : [0x7e, 0x00, 0x03, byte(code), 0x03, 0x00, 0x00, 0x00, 0xef];
}

/** Vitesse des effets, 0 (lent) à 100 (rapide). */
export function elkSpeed(model: ElkModel, percent: number): number[] {
  const p = pct(percent);
  return model === 'melk' ? [0x7e, 0x04, 0x02, p, 0xff, 0xff, 0xff, 0x00, 0xef] : [0x7e, 0x00, 0x02, p, 0x00, 0x00, 0x00, 0x00, 0xef];
}
