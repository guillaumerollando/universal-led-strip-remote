/**
 * Assistant d'ajout d'un ruban infrarouge.
 *
 * 1. On demande si le ruban est allumé ou éteint.
 * 2. Rafales rapides (16 codes par émission, avec le silence réglementaire entre deux codes — sans lui, le récepteur
 *    mélange les codes et n'en comprend aucun) : d'abord les codes adaptés à l'état du ruban, puis tous les codes des
 *    adresses courantes. L'utilisateur touche l'écran dès que le ruban réagit.
 * 3. Affinage avec l'utilisateur : les familles connues présentes dans les codes envoyés juste avant la tape sont
 *    rejouées une par une (allumer + deux couleurs) ; une tape désigne la bonne. Codes inconnus : réduction par moitiés.
 *
 * Tout ici est pur (pas d'émission) : l'écran envoie les codes et note l'heure des tapes.
 */

import type { Rgb } from './elk';
import { REMOTE_24, REMOTE_24_FF, REMOTE_44, type IrCandidate, type IrKey, type IrRemote } from './ir';

export type { IrCandidate };

export type Address = readonly [number, number];

/** Comment allumer et éteindre un ruban. */
export interface PowerCodes {
  address: Address;
  on?: number;
  off?: number;
  /** Touche unique marche/arrêt (quand il n'y a pas d'allumer / éteindre séparés). */
  toggle?: number;
}

export type LayoutId = 'classic24' | 'full44' | 'ff24' | 'bulb24';

/** Ce que Rubanix retient d'un ruban infrarouge. */
export interface IrSetup {
  power: PowerCodes;
  layout?: LayoutId;
}

const sameAddress = (a: Address, b: Address): boolean => a[0] === b[0] && a[1] === b[1];
const notPower = (k: IrKey): boolean => !k.kind.startsWith('power');

const c = (id: string, label: string, command: number, r: number, g: number, b: number): IrKey => ({ id, label, command, kind: 'color', rgb: { r, g, b } });
const fx = (id: string, label: string, command: number): IrKey => ({ id, label, command, kind: 'effect' });

/** Les jeux de touches (luminosité, couleurs, effets) que Rubanix sait piloter. */
export const LAYOUTS: Record<LayoutId, { address: Address; keys: IrKey[] }> = {
  classic24: { address: REMOTE_24.address, keys: REMOTE_24.keys.filter(notPower) },
  full44: { address: REMOTE_44.address, keys: REMOTE_44.keys.filter(notPower) },
  ff24: { address: REMOTE_24_FF.address, keys: REMOTE_24_FF.keys.filter(notPower) },
  // Famille « ampoule » de Flipper-IRDB (ISY, Osram 24 touches…) : couleurs principales et effets connus.
  bulb24: {
    address: [0x00, 0xff],
    keys: [
      { id: 'up', label: 'Plus fort', command: 0x05, kind: 'brighter' },
      { id: 'down', label: 'Moins fort', command: 0x04, kind: 'dimmer' },
      c('r', 'Rouge', 0x09, 255, 0, 0),
      c('g', 'Vert', 0x08, 0, 255, 0),
      c('b', 'Bleu', 0x0a, 0, 0, 255),
      c('w', 'Blanc', 0x0b, 255, 255, 255),
      fx('flash', 'Flash', 0x0f),
      fx('strobe', 'Stroboscope', 0x17),
      fx('fade', 'Fondu', 0x1b),
      fx('smooth', 'Doux', 0x13),
    ],
  },
};

/** Familles connues à allumer / éteindre séparés, les plus répandues d'abord (tables Arduino et Flipper-IRDB). */
export const POWER_FAMILIES: (PowerCodes & { id: string; layout?: LayoutId })[] = [
  { id: 'classic24', address: [0x00, 0xef], on: 0x03, off: 0x02, layout: 'classic24' },
  { id: 'ff24', address: [0x00, 0xff], on: 0x11, off: 0x15, layout: 'ff24' },
  { id: 'bulb24', address: [0x00, 0xff], on: 0x07, off: 0x06, layout: 'bulb24' },
  { id: 'sylvania', address: [0x00, 0xff], on: 0x0d, off: 0x1f },
  { id: 'mp3', address: [0x00, 0xff], on: 0x45, off: 0x47 },
  { id: 'jelly', address: [0x00, 0xff], on: 0x05, off: 0x04 },
  { id: 'strip8x', address: [0x00, 0xff], on: 0x83, off: 0x82 },
  { id: 'monster', address: [0x00, 0xef], on: 0x00, off: 0x01 },
  { id: 'ove', address: [0x02, 0xfd], on: 0x00, off: 0x02 },
  { id: 'idual', address: [0x02, 0xfe], on: 0x01, off: 0x02 },
];

/** La bascule marche/arrêt de la télécommande 44 touches, essayée après les familles à allumer / éteindre séparés. */
export const TOGGLE_44: PowerCodes = { address: [0x00, 0xff], toggle: 0x40 };


/** Jeu de couleurs par défaut quand on n'a pas pu (ou pas eu besoin de) demander. */
export function defaultLayout(power: PowerCodes, family?: LayoutId): LayoutId | undefined {
  if (family) return family;
  if (sameAddress(power.address, [0x00, 0xef])) return 'classic24';
  if (sameAddress(power.address, [0x00, 0xff])) return 'full44';
  return undefined;
}

// ── Le ruban configuré, sous forme de télécommande ───────────────────────

/** Fabrique la télécommande d'un ruban : ses touches marche/arrêt + son jeu de couleurs. */
export function remoteFromSetup(setup: IrSetup): IrRemote {
  const { power } = setup;
  const keys: IrKey[] = [];
  if (power.toggle !== undefined) keys.push({ id: 'power', label: 'Marche/arrêt', command: power.toggle, kind: 'power-toggle' });
  if (power.on !== undefined) keys.push({ id: 'on', label: 'Allumer', command: power.on, kind: 'power-on' });
  if (power.off !== undefined) keys.push({ id: 'off', label: 'Éteindre', command: power.off, kind: 'power-off' });
  const layout = setup.layout ? LAYOUTS[setup.layout] : undefined;
  if (layout && sameAddress(layout.address, power.address)) keys.push(...layout.keys);
  return { id: 'nec24', label: 'Ruban', address: power.address, columns: 4, keys };
}

// ── Familles connues : tous leurs codes ──────────────────────────────────

/** Une façon de parler au ruban, avec tous les codes qu'on lui connaît. */
export interface IrFamily {
  id: string;
  setup: IrSetup;
  /** Tous les codes connus de la famille (pour savoir si elle a pu faire réagir le ruban). */
  codes: IrCandidate[];
}

function familyFrom(id: string, setup: IrSetup): IrFamily {
  const { power } = setup;
  const commands = new Set<number>();
  for (const c of [power.on, power.off, power.toggle]) if (c !== undefined) commands.add(c);
  if (setup.layout && sameAddress(LAYOUTS[setup.layout].address, power.address)) for (const k of LAYOUTS[setup.layout].keys) commands.add(k.command);
  return { id, setup, codes: [...commands].map((command) => ({ address: power.address, command })) };
}

/** Les familles connues, des plus répandues aux plus rares. */
export const FAMILIES: IrFamily[] = [
  familyFrom('classic24', { power: { address: [0x00, 0xef], on: 0x03, off: 0x02 }, layout: 'classic24' }),
  familyFrom('full44', { power: { address: [0x00, 0xff], toggle: 0x40 }, layout: 'full44' }),
  familyFrom('ff24', { power: { address: [0x00, 0xff], on: 0x11, off: 0x15 }, layout: 'ff24' }),
  familyFrom('bulb24', { power: { address: [0x00, 0xff], on: 0x07, off: 0x06 }, layout: 'bulb24' }),
  // Familles dont on ne connaît que marche / arrêt : pas de couleurs (leur prêter celles d'une autre famille brouillerait l'affinage).
  ...POWER_FAMILIES.filter((f) => !f.layout).map((f) => familyFrom(f.id, { power: { address: f.address, on: f.on, off: f.off } })),
];

const key = (c: IrCandidate): string => `${c.address[0]}.${c.address[1]}.${c.command}`;

// ── Rafales ──────────────────────────────────────────────────────────────

export type StripState = 'on' | 'off';

/** Codes par émission (15 trames + queue protectrice ≈ 1,8 s, sous la limite de 2 s d'Android). */
export const BURST = 15;

/**
 * L'ordre d'envoi : d'abord ce qui doit faire réagir un ruban dans cet état (allumer s'il est éteint ; éteindre et
 * couleurs s'il est allumé), puis tous les autres codes connus, puis toutes les commandes des adresses 00 FF et 00 EF.
 * Sans doublon ; découpé en rafales de 16.
 */
export function burstPlan(state: StripState): IrCandidate[][] {
  const first: IrCandidate[] = [];
  for (const f of FAMILIES) {
    const p = f.setup.power;
    if (state === 'off') {
      if (p.on !== undefined) first.push({ address: p.address, command: p.on });
      if (p.toggle !== undefined) first.push({ address: p.address, command: p.toggle });
    } else {
      if (p.off !== undefined) first.push({ address: p.address, command: p.off });
      if (p.toggle !== undefined) first.push({ address: p.address, command: p.toggle });
    }
  }
  const colors = FAMILIES.flatMap((f) =>
    f.setup.layout ? LAYOUTS[f.setup.layout].keys.filter((k) => k.kind === 'color').slice(0, 4).map((k) => ({ address: f.setup.power.address, command: k.command })) : [],
  );
  const sweep = ([[0x00, 0xff], [0x00, 0xef]] as const).flatMap((address) => Array.from({ length: 256 }, (_, command) => ({ address, command })));
  const all = [...first, ...colors, ...sweep];
  const seen = new Set<string>();
  const unique = all.filter((c) => (seen.has(key(c)) ? false : (seen.add(key(c)), true)));
  const bursts: IrCandidate[][] = [];
  for (let i = 0; i < unique.length; i += BURST) bursts.push(unique.slice(i, i + BURST));
  return bursts;
}

/** Temps de réaction moyen entre le changement du ruban et la tape. */
export const REACTION_MS = 700;

export interface BurstWindow {
  index: number;
  start: number;
  end: number;
}

/** Les rafales qui ont pu faire réagir le ruban : celle qui jouait un temps de réaction avant la tape, et la précédente. */
export function suspectBursts(windows: BurstWindow[], tapAt: number): number[] {
  const t = tapAt - REACTION_MS;
  let i = windows.findIndex((w) => w.start <= t && t <= w.end);
  if (i < 0) i = windows.reduce((last, w, j) => (w.end < t ? j : last), 0);
  const out = [windows[i]?.index, windows[i - 1]?.index, windows[i + 1]?.index].filter((x): x is number => x !== undefined);
  return [...new Set(out)];
}

// ── Affinage ─────────────────────────────────────────────────────────────

/** Une piste à vérifier avec l'utilisateur. */
export type Lead = { kind: 'family'; family: IrFamily } | { kind: 'codes'; codes: IrCandidate[] };

/**
 * Les pistes, d'après les codes suspects : chaque famille connue qui en contient au moins un (celles qui en contiennent
 * le plus d'abord), puis les codes suspects qu'aucune famille ne connaît.
 */
export function leadsFrom(suspects: IrCandidate[]): Lead[] {
  const keys = new Set(suspects.map(key));
  const scored = FAMILIES.map((family) => ({ family, n: family.codes.filter((c) => keys.has(key(c))).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const known = new Set(FAMILIES.flatMap((f) => f.codes.map(key)));
  const unknown = suspects.filter((c) => !known.has(key(c)));
  const leads: Lead[] = scored.map((x) => ({ kind: 'family', family: x.family }));
  if (unknown.length) leads.push({ kind: 'codes', codes: unknown });
  return leads;
}

export interface Step {
  code: IrCandidate;
  rgb?: Rgb;
}

/**
 * Ce qu'on rejoue pour vérifier une famille, visible quel que soit l'état du ruban : allumer (ou basculer s'il est
 * éteint), puis deux couleurs ; pour une famille sans couleurs connues : éteindre puis allumer.
 */
export function verifySteps(family: IrFamily, believedOn: boolean): Step[] {
  const { power, layout } = family.setup;
  // Couleurs qui ne sont le code marche / arrêt d'aucune autre famille de même adresse (ex. 0x45 = bleu de la 44 touches,
  // mais « allumer » d'une autre) : sinon la vérification confirmerait la mauvaise famille.
  const powerCodes = new Set(
    FAMILIES.filter((f) => f !== family && sameAddress(f.setup.power.address, power.address)).flatMap((f) =>
      [f.setup.power.on, f.setup.power.off, f.setup.power.toggle].filter((c): c is number => c !== undefined),
    ),
  );
  const colors =
    layout && sameAddress(LAYOUTS[layout].address, power.address)
      ? LAYOUTS[layout].keys.filter((k) => k.kind === 'color' && !powerCodes.has(k.command))
      : [];
  const steps: Step[] = [];
  if (power.on !== undefined) steps.push({ code: { address: power.address, command: power.on } });
  else if (power.toggle !== undefined && !believedOn) steps.push({ code: { address: power.address, command: power.toggle } });
  if (colors.length >= 2) {
    steps.push({ code: { address: power.address, command: colors[0].command }, rgb: colors[0].rgb });
    steps.push({ code: { address: power.address, command: colors[2].command }, rgb: colors[2].rgb });
  } else if (power.off !== undefined && power.on !== undefined) {
    steps.push({ code: { address: power.address, command: power.off } }, { code: { address: power.address, command: power.on } });
  }
  return steps;
}

/** Réglage retenu pour des codes inconnus : l'adresse trouvée, avec ce qu'on sait d'elle. */
export function setupForUnknown(code: IrCandidate): IrSetup {
  const a = code.address;
  if (sameAddress(a, [0x00, 0xff])) return { power: { address: a, toggle: code.command }, layout: 'full44' };
  if (sameAddress(a, [0x00, 0xef])) return { power: { address: a, on: 0x03, off: 0x02 }, layout: 'classic24' };
  return { power: { address: a, toggle: code.command } };
}

/** Réduction par moitiés d'une liste de codes : « cette moitié l'a fait réagir ? ». */
export interface Halving {
  remaining: IrCandidate[];
  testing: IrCandidate[];
}

export const startHalving = (codes: IrCandidate[]): Halving => ({ remaining: codes, testing: codes.slice(0, Math.ceil(codes.length / 2)) });

export function answerHalving(h: Halving, reacted: boolean): Halving | IrCandidate | null {
  const next = reacted ? h.testing : h.remaining.filter((c) => !h.testing.includes(c));
  if (next.length === 0) return null;
  if (next.length === 1) return next[0];
  return startHalving(next);
}
