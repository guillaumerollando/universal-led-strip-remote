/**
 * « Créer mon ambiance » (rubans à pixels OpenBeken) : l'utilisateur choisit un style, ses couleurs et quelques
 * réglages, et peut refaire toutes les ambiances de l'appli (souhait de Guillaume, 2026-11-27 : « il faut que ce soit
 * reproductible par l'utilisateur »). Chaque style s'appuie sur un moteur validé sur le vrai ruban (`obkScripts.ts`),
 * avec ses garde-fous : nombre de couleurs, tailles et vitesses bornés, fichier court.
 */
import {
  bandsScript,
  flickerScript,
  glowScript,
  leavesScript,
  MIN_DELAY_MS,
  snakeScript,
  stepScript,
  stillScript,
  type ScriptContext,
} from './obkScripts';
import { cellLeds } from './motifTools';
import type { MotifMode } from './protocols/openbeken';
import type { Rgb } from './protocols/types';

export type CreationStyle = 'motif' | 'bands' | 'glows' | 'step' | 'flicker' | 'leaves';
/** Taille : des bandes, des lueurs. */
export type Size = 'small' | 'medium' | 'large';

export interface Creation {
  style: CreationStyle;
  /** Couleurs : les cases du motif, ou les couleurs des bandes / lueurs / ampoules / feuilles. */
  colors: Rgb[];
  /** Fond (bandes, lueurs, feuilles). */
  bg: Rgb;
  /** Motif : serpent, défile ou fixe. */
  mode: MotifMode;
  /** Nombre de LED par case dessinée (guirlande : 1, 2, 5 ou 10). Motif : 1 (une case par LED du ruban). */
  cell: number;
  size: Size;
  /** Vitesse 0-100 %. */
  speed: number;
}

/** Limites de chaque style (au-delà, le ruban ralentit ou plante). */
export const LIMITS: Record<CreationStyle, { min: number; max: number }> = {
  // Le motif se dessine LED par LED sur tout le ruban (grille en S de l'éditeur).
  motif: { min: 1, max: 1000 },
  bands: { min: 1, max: 4 },
  glows: { min: 1, max: 4 },
  step: { min: 1, max: 20 },
  flicker: { min: 1, max: 4 },
  leaves: { min: 1, max: 6 },
};
export const CELLS = [1, 2, 5, 10];
/** Un serpent redessine toutes ses LED à chaque pas : au plus 40 LED (au-delà, le ruban ralentit). */
export const SNAKE_MAX_LEDS = 40;
/** Le ruban accepte ~6 Ko d'un bloc ; on garde de la marge. */
export const SCRIPT_MAX_BYTES = 5000;

const repeatCells = (colors: Rgb[], cell: number): Rgb[] => colors.flatMap((c) => Array.from({ length: cell }, () => c));
const lerp = (a: number, b: number, k: number): number => Math.round(a + (b - a) * k);
/** Vitesse 0-100 % → pause (ms) entre `slow` et `fast`, jamais sous le minimum sûr. */
const delay = (speed: number, slow: number, fast: number): number =>
  Math.max(MIN_DELAY_MS, lerp(slow, fast, Math.min(100, Math.max(0, speed)) / 100));

const BAND = { small: { width: 16, ramp: 4 }, medium: { width: 30, ramp: 7 }, large: { width: 44, ramp: 10 } };
const GLOW = {
  small: [0.35, 1, 0.35],
  medium: [0.3, 0.7, 1, 0.7, 0.3],
  large: [0.15, 0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35, 0.15],
};

/** Le script d'une création, pour un ruban donné. */
export function creationScript(c: Creation, ctx: ScriptContext): string[] {
  const colors = c.colors.slice(0, LIMITS[c.style].max);
  switch (c.style) {
    case 'motif': {
      const pattern = repeatCells(colors, c.cell);
      if (c.mode === 'snake') {
        // Dessin sur tout le ruban : sa partie allumée ; ancien petit dessin : agrandi tant qu'il reste court.
        const cell = Math.max(1, Math.min(c.cell, Math.floor(SNAKE_MAX_LEDS / Math.max(1, colors.length))));
        const snake = pattern.length >= ctx.n ? snakeOf(pattern) : snakeOf(repeatCells(colors, cell));
        return snakeScript(snake, ctx, delay(c.speed, 170, MIN_DELAY_MS));
      }
      return c.mode === 'flow' ? stepScript(pattern, ctx, delay(c.speed, 1000, 300)) : stillScript(pattern, ctx);
    }
    case 'step':
      return stepScript(repeatCells(colors, c.cell), ctx, delay(c.speed, 1000, 300));
    case 'bands': {
      const { width, ramp } = BAND[c.size];
      const bands = colors.map((color, i) => ({ color, width, ramp, offset: Math.round((i * ctx.n) / colors.length) }));
      // Plus de deux bandes : sans pré-remplissage, pour garder le fichier court (elles se construisent en avançant).
      return bandsScript(c.bg, bands, ctx, delay(c.speed, 160, 50), bands.length <= 2);
    }
    case 'glows':
      return glowScript(c.bg, colors, GLOW[c.size], ctx, lerp(18, 8, c.speed / 100), delay(c.speed, 100, 55));
    case 'flicker':
      return flickerScript(colors, 2, ctx);
    case 'leaves':
      return leavesScript(c.bg, colors, ctx);
  }
}

const OFF: Rgb = { r: 0, g: 0, b: 0 };
const isLit = (c: Rgb): boolean => c.r + c.g + c.b > 0;

/** Le serpent d'un dessin : sa partie allumée (de la première à la dernière LED allumée), 40 LED au plus. */
export function snakeOf(pixels: Rgb[]): Rgb[] {
  const first = pixels.findIndex(isLit);
  if (first < 0) return pixels.slice(0, 1);
  let last = pixels.length - 1;
  while (!isLit(pixels[last])) last -= 1;
  return pixels.slice(first, last + 1).slice(0, SNAKE_MAX_LEDS);
}

/**
 * Un motif ramené à tout le ruban (souhait de Guillaume, 2026-11-27 : « afficher toutes les LED, plus simple qu'un
 * réglage ») : au plus 60 cases, chacune de `cellLeds(n)` LED. Un dessin fait pour une autre longueur est
 * redécoupé ; en serpent, il se pose au début du ruban, sinon il se répète tout le long.
 */
export function toFullStrip(c: Creation, n: number): Creation {
  const k = cellLeds(n);
  const cells = Math.ceil(n / k);
  if (c.style !== 'motif' || (c.cell === k && c.colors.length === cells)) return c;
  const pattern = repeatCells(c.colors.length > 0 ? c.colors : [OFF], Math.max(1, c.cell));
  const perLed =
    c.mode === 'snake'
      ? Array.from({ length: n }, (_, i) => pattern[i] ?? OFF)
      : Array.from({ length: n }, (_, i) => pattern[i % pattern.length]);
  return { ...c, colors: Array.from({ length: cells }, (_, i) => perLed[i * k]), cell: k };
}

/** Taille du script (octets) : au-delà de `SCRIPT_MAX_BYTES`, l'éditeur demande de simplifier. */
export const creationBytes = (c: Creation, ctx: ScriptContext): number => creationScript(c, ctx).join('\n').length + 1;

/** Ce qu'on retient de la création pour la reconstruire (luminosité, autre ruban). */
export const encodeCreation = (c: Creation): string => JSON.stringify(c);
export function decodeCreation(text: string | undefined): Creation | undefined {
  try {
    const c = JSON.parse(text ?? '') as Creation;
    return c && Array.isArray(c.colors) && typeof c.style === 'string' ? { ...DEFAULTS, ...c } : undefined;
  } catch {
    return undefined;
  }
}

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });
export const DEFAULTS: Creation = {
  style: 'motif',
  colors: [rgb(255, 0, 0), rgb(255, 80, 0), rgb(255, 200, 0), rgb(0, 255, 0), rgb(0, 255, 200), rgb(0, 80, 255), rgb(120, 0, 255), rgb(255, 0, 160)],
  bg: rgb(0, 5, 35),
  mode: 'snake',
  cell: 1,
  size: 'medium',
  speed: 55,
};
