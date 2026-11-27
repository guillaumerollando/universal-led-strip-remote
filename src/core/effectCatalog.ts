/**
 * Catalogue complet des effets intégrés aux contrôleurs Bluetooth (et Magic Home), pour les bidouilleurs : section
 * « Tous les effets », repliée par défaut, à côté des quelques effets choisis. Chaque effet a un nom composé de mots
 * déjà traduits (« Effet 12 », ou effet + couleurs), pour ne pas traduire 260 libellés.
 *
 * MELK : simplement numérotés. Les noms de familles d'elkbledom ne correspondaient pas à ce que fait le MELK-OA21 de
 * Guillaume (essai du 2026-11-27) ; les couleurs, elles, ont été relevées en photo sur son ruban.
 * Sources : elkbledom (liste ELK classique), flux_led (`PresetPattern`).
 */
import type { Effect, Rgb } from './protocols/types';

/** Un effet du catalogue : `parts` = mots (clés françaises) affichés traduits et joints, `num` = numéro dans la famille. */
export interface CatalogEffect extends Effect {
  parts: string[];
  num?: number;
}

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });
const K = rgb(0, 0, 0);
const R = rgb(255, 0, 0);
const G = rgb(0, 230, 0);
const B = rgb(0, 40, 255);
const Y = rgb(255, 200, 0);
const C = rgb(0, 220, 255);
const P = rgb(170, 0, 255);
const PK = rgb(255, 0, 140);
const W = rgb(255, 255, 255);
const O = rgb(255, 100, 0);
const RAINBOW = [R, O, Y, G, C, B, P];

// ── MELK (catalogue « STRIPX » : 1 à 220) ─────────────────────────────────────────────

/** Couleurs vues en photo sur le MELK-OA21 (vitesse 60). */
const MELK_SEEN: Record<number, Rgb[]> = {
  1: RAINBOW, 3: RAINBOW, 4: [P, B, PK], 5: [R, G, B], 6: [G, R, B], 7: [Y, C, PK], 8: [PK, B, C], 9: [PK, Y, P], 10: [O, PK, Y],
  11: [C, Y, W], 12: [C, Y], 13: [B, PK, P], 14: [P, B, PK], 15: [C, B, PK], 16: [B, C, PK],
  23: RAINBOW, 24: RAINBOW, 25: [R], 26: [R], 27: [G], 28: [G], 29: [B], 30: [B], 31: [Y], 32: [Y], 33: [C], 34: [C],
  55: [W], 56: [W], 57: [G, O], 58: [R, Y], 59: [R, PK, B], 60: [R, G],
  61: [P, O, B], 62: [Y, C], 63: [R], 64: [R], 65: [G], 66: [G], 67: [B],
  74: [PK], 75: [W], 76: [W], 77: [R], 78: [R, G], 79: [G], 80: [B, R], 81: [C], 82: [PK, Y], 83: [W], 84: [W], 85: [W],
  144: [PK], 145: [W], 146: [W], 147: [P], 148: [P], 149: [W], 150: [W],
  168: [B], 169: [R], 170: [R], 171: [B], 172: [B],
  202: RAINBOW, 203: [Y, G], 204: [P, B], 205: [R], 206: [G], 207: [B], 208: [Y], 209: [C], 210: [PK], 211: [W],
};

export const MELK_CATALOG: CatalogEffect[] = Array.from({ length: 220 }, (_, i) => {
  const code = i + 1;
  const colors = MELK_SEEN[code];
  return {
    id: `cat-${code}`,
    label: 'Effet',
    parts: ['Effet'],
    num: code,
    code,
    preview: colors ? (colors.length === 1 ? [colors[0], K] : colors) : RAINBOW,
  };
});

// ── ELK-BLEDOM classique (0x87 à 0x9c) ─────────────────────────────────────────────────

const named = (code: number, parts: string[], preview: Rgb[]): CatalogEffect => ({ id: `cat-${code}`, label: parts.join(' '), parts, code, preview });
const dimOf = (c: Rgb): Rgb => rgb(c.r * 0.15, c.g * 0.15, c.b * 0.15);

export const ELK_CATALOG: CatalogEffect[] = [
  named(0x87, ['Saut', 'Rouge', 'Vert', 'Bleu'], [R, G, B]),
  named(0x88, ['Saut', '7 couleurs'], RAINBOW),
  named(0x89, ['Fondu', 'Rouge', 'Vert', 'Bleu'], [R, G, B]),
  named(0x8a, ['Fondu', '7 couleurs'], RAINBOW),
  ...([
    [0x8b, 'Rouge', R],
    [0x8c, 'Vert', G],
    [0x8d, 'Bleu', B],
    [0x8e, 'Jaune', Y],
    [0x8f, 'Cyan', C],
    [0x90, 'Violet', P],
    [0x91, 'Blanc', W],
  ] as const).map(([code, color, c]) => named(code, ['Respiration', color], [c, dimOf(c)])),
  named(0x92, ['Fondu', 'Rouge', 'Vert'], [R, G]),
  named(0x93, ['Fondu', 'Rouge', 'Bleu'], [R, B]),
  named(0x94, ['Fondu', 'Vert', 'Bleu'], [G, B]),
  named(0x95, ['Clignote', '7 couleurs'], RAINBOW),
  ...([
    [0x96, 'Rouge', R],
    [0x97, 'Vert', G],
    [0x98, 'Bleu', B],
    [0x99, 'Jaune', Y],
    [0x9a, 'Cyan', C],
    [0x9b, 'Violet', P],
    [0x9c, 'Blanc', W],
  ] as const).map(([code, color, c]) => named(code, ['Clignote', color], [c, K])),
];

// ── Magic Home, Triones, Zengge (0x25 à 0x38) ──────────────────────────────────────────

export const LEDNET_CATALOG: CatalogEffect[] = [
  named(0x25, ['Fondu', '7 couleurs'], RAINBOW),
  ...([
    [0x26, 'Rouge', R],
    [0x27, 'Vert', G],
    [0x28, 'Bleu', B],
    [0x29, 'Jaune', Y],
    [0x2a, 'Cyan', C],
    [0x2b, 'Violet', P],
    [0x2c, 'Blanc', W],
  ] as const).map(([code, color, c]) => named(code, ['Respiration', color], [c, dimOf(c)])),
  named(0x2d, ['Fondu', 'Rouge', 'Vert'], [R, G]),
  named(0x2e, ['Fondu', 'Rouge', 'Bleu'], [R, B]),
  named(0x2f, ['Fondu', 'Vert', 'Bleu'], [G, B]),
  named(0x30, ['Clignote', '7 couleurs'], RAINBOW),
  ...([
    [0x31, 'Rouge', R],
    [0x32, 'Vert', G],
    [0x33, 'Bleu', B],
    [0x34, 'Jaune', Y],
    [0x35, 'Cyan', C],
    [0x36, 'Violet', P],
    [0x37, 'Blanc', W],
  ] as const).map(([code, color, c]) => named(code, ['Clignote', color], [c, K])),
  named(0x38, ['Saut', '7 couleurs'], RAINBOW),
];
