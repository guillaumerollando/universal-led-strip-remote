/**
 * Moteurs de scripts OpenBeken pour rubans à pixels : de petits programmes qui tournent dans le ruban (téléphone
 * éteint compris). Tous mis au point avec Guillaume sur son ruban (séries de tests numérotés, 2026-11-27).
 *
 * Règles tirées de ces essais (ne pas les enfreindre, le ruban plante ou n'affiche rien) :
 * - un seul **fichier court** qui boucle sur lui-même (`if … then goto`) ; jamais de long script déroulé ni de
 *   fichiers chaînés pour une animation (ils s'affichaient mal ou faisaient redémarrer le ruban) ;
 * - peu de lignes par pas, et **jamais de pause sous 40 ms** (`delay_ms 0` gèle le ruban : chien de garde, mode sécurité) ;
 * - `SM16703P_SetPixel` accepte des calculs : `(($CH30+5)%200)`, `(10+40*$CH32/12)`, `$rand01` (0-1) ;
 *   `$rand` seul donne des positions qui se répètent : toujours `$rand01*n` ;
 * - les couleurs sont ramenées à la luminosité choisie (les pixels posés un à un ne suivent pas `Dimmer`).
 */
import { clamp, dim, type Rgb } from './protocols/types';

const lerp = (a: Rgb, b: Rgb, k: number): Rgb => ({
  r: Math.round(a.r + (b.r - a.r) * k),
  g: Math.round(a.g + (b.g - a.g) * k),
  b: Math.round(a.b + (b.b - a.b) * k),
});
const rgb3 = ({ r, g, b }: Rgb): string => `${r} ${g} ${b}`;
/** Pause sûre : jamais sous 40 ms entre deux envois. */
export const MIN_DELAY_MS = 40;
const pause = (ms: number): string => `delay_ms ${Math.max(MIN_DELAY_MS, Math.round(ms))}`;

export interface ScriptContext {
  /** Nombre de LED du ruban. */
  n: number;
  /** Luminosité 0-100 appliquée aux couleurs. */
  level: number;
}
const lit = (c: Rgb, ctx: ScriptContext): Rgb => dim(c, ctx.level);

/** En-tête commun : coupe l'animation intégrée éventuelle (sinon elle redessine par-dessus). */
const HEAD = ['Anim -1'];

/**
 * Motif répété tout le long, dessiné par boucles (une par couleur, cinq lignes chacune) : léger quel que soit le
 * nombre de LED. Décalé de `$CH30` (0 si fixe).
 */
export function garlandDraw(pattern: Rgb[], ctx: ScriptContext, label = 'g', moving = true): string[] {
  const p = pattern.length;
  // LED voisines de même couleur regroupées en « séries » : une boucle par série, pas par LED (motifs à grandes cases).
  const runs: { start: number; len: number; color: Rgb }[] = [];
  pattern.forEach((c, j) => {
    const last = runs[runs.length - 1];
    if (last && last.color.r === c.r && last.color.g === c.g && last.color.b === c.b) last.len += 1;
    else runs.push({ start: j, len: 1, color: c });
  });
  if (p >= ctx.n) return fullDraw(runs, ctx, label, moving);
  return runs.flatMap(({ start, len, color }) => {
    const set = (pos: string): string => `SM16703P_SetPixel ((${pos}+$CH30)%${ctx.n}) ${rgb3(lit(color, ctx))}`;
    if (len === 1) {
      return [`setChannel 34 ${start}`, `${label}${start}:`, set('$CH34'), `addChannel 34 ${p}`, `if $CH34<${ctx.n} then goto ${label}${start}`];
    }
    return [
      `setChannel 34 ${start}`,
      `${label}${start}:`,
      'setChannel 35 0',
      `${label}${start}s:`,
      set('$CH34+$CH35'),
      'addChannel 35 1',
      `if $CH35<${len} then goto ${label}${start}s`,
      `addChannel 34 ${p}`,
      `if $CH34<${ctx.n} then goto ${label}${start}`,
    ];
  });
}

type Run = { start: number; len: number; color: Rgb };
const same = (a: Rgb, b: Rgb): boolean => a.r === b.r && a.g === b.g && a.b === b.b;

/**
 * Dessin qui couvre tout le ruban (une case par LED) : la couleur la plus répétée sert de fond (`all`), puis chaque
 * série d'une autre couleur est posée une fois — une ligne par LED isolée, une petite boucle pour une série.
 */
function fullDraw(runs: Run[], ctx: ScriptContext, label: string, moving: boolean): string[] {
  const n = ctx.n;
  const kept = runs.filter((r) => r.start < n).map((r) => ({ ...r, len: Math.min(r.len, n - r.start) }));
  const counts = new Map<string, { color: Rgb; runs: number }>();
  for (const r of kept) {
    const k = rgb3(r.color);
    counts.set(k, { color: r.color, runs: (counts.get(k)?.runs ?? 0) + 1 });
  }
  const base = [...counts.values()].sort((a, b) => b.runs - a.runs)[0]?.color ?? { r: 0, g: 0, b: 0 };
  const pos = (e: string): string => (moving ? `((${e}+$CH30)%${n})` : e);
  return [
    `SM16703P_SetPixel all ${rgb3(lit(base, ctx))}`,
    ...kept
      .filter((r) => !same(r.color, base))
      .flatMap(({ start, len, color }) => {
        const c = rgb3(lit(color, ctx));
        if (len <= 2) return Array.from({ length: len }, (_, k) => `SM16703P_SetPixel ${pos(String(start + k))} ${c}`);
        return [`setChannel 34 ${start}`, `${label}${start}:`, `SM16703P_SetPixel ${pos('$CH34')} ${c}`, 'addChannel 34 1', `if $CH34<${start + len} then goto ${label}${start}`];
      }),
  ];
}

/** Guirlande fixe : dessinée une fois, puis le script s'arrête. */
export function stillScript(pattern: Rgb[], ctx: ScriptContext): string[] {
  return [...HEAD, 'setChannel 30 0', ...garlandDraw(pattern, ctx, 'g', false), 'SM16703P_Start'];
}

/** Guirlande qui avance d'un cran à chaque pas (Noël « clignotant », validé : « parfait »). */
export function stepScript(pattern: Rgb[], ctx: ScriptContext, delayMs: number): string[] {
  return [
    ...HEAD,
    'setChannel 30 0',
    'again:',
    ...garlandDraw(pattern, ctx),
    'SM16703P_Start',
    `addChannel 30 1 0 ${pattern.length - 1} 1`,
    // Redessiner tout le ruban prend ~0,6 s : la pause s'ajoute.
    pause(Math.max(300, delayMs)),
    'goto again',
  ];
}

/** Un serpent : un seul motif qui parcourt le ruban, sur fond `bg` (éteint par défaut). */
export function snakeScript(pixels: Rgb[], ctx: ScriptContext, delayMs: number, bg: Rgb = { r: 0, g: 0, b: 0 }): string[] {
  const n = ctx.n;
  const at = (k: number): string => `(($CH30+${k % n})%${n})`;
  return [
    ...HEAD,
    `SM16703P_SetPixel all ${rgb3(lit(bg, ctx))}`,
    'setChannel 30 0',
    'again:',
    `SM16703P_SetPixel ${at(n - 1)} ${rgb3(lit(bg, ctx))}`,
    ...pixels.map((p, k) => `SM16703P_SetPixel ${at(k)} ${rgb3(lit(p, ctx))}`),
    'SM16703P_Start',
    `addChannel 30 1 0 ${n - 1} 1`,
    pause(delayMs),
    'goto again',
  ];
}

export interface Band {
  color: Rgb;
  width: number;
  /** Largeur du fondu de chaque bord. */
  ramp: number;
  /** Position de départ. */
  offset: number;
}

/**
 * Bandes larges à bords doux qui glissent sur un fond (Aurore, validée : « magnifique ») : à chaque pas, seuls les
 * bords changent, donc c'est léger et fluide quelle que soit la largeur.
 */
export function bandsScript(bg: Rgb, bands: Band[], ctx: ScriptContext, delayMs: number, prefill = true): string[] {
  const n = ctx.n;
  const B = lit(bg, ctx);
  // Sans pré-remplissage (bandes nombreuses ou longues), les bandes se construisent toutes seules en avançant : le
  // fichier reste court.
  const fill = !prefill ? [] : bands.flatMap(({ color, width, ramp, offset }) =>
    Array.from({ length: width }, (_, p) => {
      const r = Math.min(p, width - 1 - p);
      return `SM16703P_SetPixel ${(offset + p) % n} ${rgb3(lit(lerp(bg, color, Math.min(1, (r + 1) / (ramp + 1))), ctx))}`;
    }),
  );
  const step = bands.flatMap(({ color, width, ramp, offset }) => [
    `SM16703P_SetPixel (($CH33+${(n - 1 + offset) % n})%${n}) ${rgb3(B)}`,
    ...Array.from({ length: ramp + 1 }, (_, r) => {
      const c = rgb3(lit(lerp(bg, color, (r + 1) / (ramp + 1)), ctx));
      return [`SM16703P_SetPixel (($CH33+${(offset + r) % n})%${n}) ${c}`, `SM16703P_SetPixel (($CH33+${(offset + width - 1 - r) % n})%${n}) ${c}`];
    }).flat(),
  ]);
  return [
    ...HEAD,
    `SM16703P_SetPixel all ${rgb3(B)}`,
    ...fill,
    'SM16703P_Start',
    'setChannel 33 0',
    'again:',
    ...step,
    'SM16703P_Start',
    `addChannel 33 1 0 ${n - 1} 1`,
    pause(delayMs),
    'goto again',
  ];
}

/**
 * Guirlande dont une ampoule au hasard grésille et s'éteint un instant, comme une vieille ampoule (Halloween,
 * validé : « parfait »). `pattern` : ampoules de `bulb` LED suivies d'une LED éteinte.
 */
export function flickerScript(colors: Rgb[], bulb: number, ctx: ScriptContext): string[] {
  const off: Rgb = { r: 0, g: 0, b: 0 };
  const pattern = colors.flatMap((c) => [...Array.from({ length: bulb }, () => c), off]);
  const period = pattern.length;
  const slot = bulb + 1;
  const bulbs = Math.floor(ctx.n / period);
  const setBulb = (c: string): string[] => Array.from({ length: bulb }, (_, k) => `SM16703P_SetPixel ($CH35+${k}) ${c}`);
  const restore = colors.map((c, j) => `if $CH36==${j} then backlog ${setBulb(rgb3(lit(c, ctx))).join('; ')}`);
  const lines = [
    ...HEAD,
    'setChannel 30 0',
    ...garlandDraw(pattern, ctx),
    'SM16703P_Start',
    'again:',
    `setChannel 36 ($rand01*${colors.length})`,
    `setChannel 35 ($rand01*${bulbs})`,
    `setChannel 35 ($CH35*${period}+$CH36*${slot})`,
  ];
  // Grésillement : éteint, rallumé, éteint plus longtemps, rallumé, éteint… puis l'ampoule revient.
  for (const [on, ms] of [[false, 60], [true, 50], [false, 140], [true, 40], [false, 70]] as const) {
    lines.push(...(on ? restore : setBulb('0 0 0')), 'SM16703P_Start', pause(ms));
  }
  lines.push(...restore, 'SM16703P_Start', pause(250), 'goto again');
  return lines;
}

/** Feuilles qui tombent : une feuille apparaît au hasard, glisse en s'éteignant, puis la suivante (Automne, validé). */
export function leavesScript(bg: Rgb, leaves: Rgb[], ctx: ScriptContext, fall = 10): string[] {
  const B = rgb3(lit(bg, ctx));
  const lines = [...HEAD, `SM16703P_SetPixel all ${B}`, 'SM16703P_Start', 'again:'];
  leaves.forEach((leaf, i) => {
    const L = lit(leaf, ctx);
    const G = lit(bg, ctx);
    const e = (['r', 'g', 'b'] as const).map((k) => `(${G[k]}+${L[k] - G[k]}*(${fall}-$CH36)/${fall})`).join(' ');
    lines.push(
      `setChannel 35 ($rand01*${ctx.n - fall - 2})`,
      'setChannel 36 0',
      `f${i}:`,
      `SM16703P_SetPixel ($CH35+$CH36-1) ${B}`,
      `SM16703P_SetPixel ($CH35+$CH36) ${e}`,
      'SM16703P_Start',
      pause(110),
      'addChannel 36 1',
      `if $CH36<${fall} then goto f${i}`,
      `SM16703P_SetPixel ($CH35+${fall - 1}) ${B}`,
      'SM16703P_Start',
      pause(150),
    );
  });
  lines.push('goto again');
  return lines;
}

/**
 * Lueurs qui naissent et s'éteignent au hasard, chacune de la couleur suivante de `colors` (Océan « plancton »,
 * validé ; Romantique « bougies »). `profile` : intensité de chaque LED de la lueur, centre à 1.
 */
export function glowScript(bg: Rgb, colors: Rgb | Rgb[], profile: number[], ctx: ScriptContext, steps: number, delayMs: number): string[] {
  const B = lit(bg, ctx);
  const half = Math.floor(profile.length / 2);
  const glow = (color: Rgb, i: number): string[] => {
    const C = lit(color, ctx);
    const body = [
      ...profile.map((w, j) => {
        const e = (['r', 'g', 'b'] as const).map((k) => `(${B[k]}+${Math.round((C[k] - B[k]) * w)}*$CH32/${steps})`).join(' ');
        return `SM16703P_SetPixel ($CH31+${j - half}) ${e}`;
      }),
      'SM16703P_Start',
      pause(delayMs),
    ];
    return [
      `setChannel 31 (${half}+$rand01*${ctx.n - 2 * half - 1})`,
      'setChannel 32 0',
      `u${i}:`,
      ...body,
      'addChannel 32 1',
      `if $CH32<${steps} then goto u${i}`,
      `d${i}:`,
      ...body,
      'addChannel 32 -1',
      `if $CH32>0 then goto d${i}`,
    ];
  };
  const list = Array.isArray(colors) ? colors : [colors];
  return [...HEAD, `SM16703P_SetPixel all ${rgb3(B)}`, 'SM16703P_Start', 'again:', ...list.flatMap(glow), 'goto again'];
}

/** Vitesse 0-100 % → pause entre deux pas d'un serpent (ms), jamais sous le minimum sûr. */
export const snakeDelay = (percent: number): number => clamp(MIN_DELAY_MS + (100 - clamp(percent, 0, 100)) * 1.3, MIN_DELAY_MS, 170);
/** Vitesse 0-100 % → pause entre deux crans d'une guirlande qui avance (ms). */
export const stepDelay = (percent: number): number => clamp(300 + (100 - clamp(percent, 0, 100)) * 7, 300, 1000);

/** Le script d'un motif dessiné par l'utilisateur. */
export function motifScript(motif: { pixels: Rgb[]; mode: 'snake' | 'flow' | 'still' }, ctx: ScriptContext, speedPercent: number): string[] {
  if (motif.mode === 'snake') return snakeScript(motif.pixels, ctx, snakeDelay(speedPercent));
  if (motif.mode === 'flow') return stepScript(motif.pixels, ctx, stepDelay(speedPercent));
  return stillScript(motif.pixels, ctx);
}
