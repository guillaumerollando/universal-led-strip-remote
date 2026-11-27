/**
 * Ambiances : quelques réglages prêts à l'emploi pour les rubans à pixels, et ceux que l'utilisateur enregistre
 * (gardés sur le téléphone, réutilisables sur n'importe quel ruban à pixels).
 *
 * Les huit de l'appli ont été choisies par Guillaume sur son ruban, une par une (séries de tests du 2026-11-27) :
 * chacune a sa propre « vibe » et son propre moteur (voir `obkScripts.ts`). Écartées : coin du feu (animation
 * intégrée saccadée), coucher de soleil, ressac, Noël scintillant, bandes pour Halloween / Automne, serpent
 * arc-en-ciel (« pas d'ambiance »), cocooning (doublon de l'automne), fête foraine (proche de Noël), bulles,
 * enseigne néon (battue par la synthwave). Tropical : peut-être à retravailler pour une neuvième.
 */
import {
  bandsScript,
  flickerScript,
  glowScript,
  leavesScript,
  stepScript,
  type ScriptContext,
} from './obkScripts';
import type { Creation } from './creations';
import type { Motif } from './protocols/openbeken';
import type { Rgb } from './protocols/types';

export interface Ambiance {
  id: string;
  /** Libellé français (traduit à l'affichage) pour les ambiances de l'appli ; nom choisi par l'utilisateur sinon. */
  label: string;
  /** Couleurs qui la résument (petite rangée de LED, widgets, ruban dessiné). */
  colors: Rgb[];
  /** Ambiance de l'appli : son script, selon le ruban (nombre de LED, luminosité). */
  build?: (ctx: ScriptContext) => string[];
  /**
   * Version pour les rubans Bluetooth MELK (un effet intégré à couleurs fixes, ou une couleur unie), choisie par
   * Guillaume sur son MELK-OA21 après une exploration en photos des effets (2026-11-27). Absente : pas proposée.
   */
  melk?: { effect: number; speed: number } | { color: Rgb };
  /**
   * Version pour les rubans simples (télécommande infrarouge, rubans à couleur unie, et ambiances absentes du MELK) :
   * la bonne couleur, ou une touche d'effet de la télécommande (`flash`…) si elle en a une.
   */
  simple?: { color: Rgb; effect?: string };
  /** Ambiance de l'appli : ses réglages exprimés comme une création, pour « partir de » elle dans l'éditeur. */
  template?: Omit<Creation, 'mode' | 'cell'> & Partial<Pick<Creation, 'mode' | 'cell'>>;
  /** Ambiance de l'utilisateur : sa création (style, couleurs, réglages). */
  creation?: Creation;
  /** Ancien format (motif dessiné avant les styles) : converti en création au chargement. */
  motif?: Motif;
  speed?: number;
  mine?: boolean;
}

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });
const OFF = rgb(0, 0, 0);

const XMAS = [rgb(255, 0, 0), rgb(0, 230, 0), rgb(0, 40, 255), rgb(255, 110, 0), rgb(255, 0, 140)];
const HALLOWEEN = [rgb(255, 60, 0), rgb(140, 0, 255)];
// Plus lumineux que la première version (Guillaume : « je préfère à l'automne classique »).
const AUTUMN_BG = rgb(130, 32, 0);
const LEAVES = [rgb(255, 20, 0), rgb(255, 90, 0), rgb(255, 170, 0), rgb(200, 55, 0)];
const ROMANTIC_BG = rgb(60, 0, 12);
// Une seule teinte (rouge profond / fuchsia) en deux bandes : la seconde bande, plus claire, ne plaisait pas.
const ROMANTIC = rgb(255, 0, 15);
// Nuit plus sombre et bande bleue moins vive (Guillaume : « faire croire à une nuit avec des aurores boréales »).
// Fond encore assombri (Guillaume, 2026-11-27 : « le bleu du fond est trop lumineux ») : 35 → 24.
const AURORA_BG = rgb(0, 3, 24);
const AURORA = [rgb(30, 110, 170), rgb(200, 0, 255)];
// Plus lumineux que la nuit de l'aurore (Guillaume : « même si c'est profond, il faut que ce soit plus lumineux »).
const MIAMI_BG = rgb(150, 0, 255);
const MIAMI = [rgb(255, 0, 45), rgb(0, 210, 255)];
// Sans aucun bleu : le vert du ruban tire déjà vers le turquoise (Guillaume : « pas assez vert »). Le jaune-vert donne
// le peps qu'il aime. Contraste adouci (fond plus clair, bandes moins vives) : « pas l'effet de l'aurore ».
const FOREST_BG = rgb(10, 75, 0);
const FOREST = [rgb(30, 170, 0), rgb(125, 180, 0)];
const OCEAN_BG = rgb(0, 12, 55);
const PLANKTON = rgb(70, 255, 230);

export const BUILTIN_AMBIANCES: Ambiance[] = [
  {
    id: 'christmas',
    simple: { color: rgb(255, 0, 0), effect: 'flash' },
    template: { style: 'step', bg: OFF, colors: XMAS.flatMap((c) => [c, OFF]), size: 'medium', speed: 43 },
    melk: { effect: 5, speed: 60 },
    label: 'Noël',
    colors: XMAS,
    // La guirlande avance d'une ampoule à la fois (« parfait »).
    build: (ctx) => stepScript(XMAS.flatMap((c) => [c, OFF]), ctx, 700),
  },
  {
    id: 'halloween',
    simple: { color: rgb(255, 60, 0) },
    template: { style: 'flicker', bg: OFF, colors: HALLOWEEN, size: 'medium', speed: 55 },
    label: 'Halloween',
    colors: HALLOWEEN,
    // Ampoules orange et violettes dont une, au hasard, grésille et s'éteint (« parfait »).
    build: (ctx) => flickerScript(HALLOWEEN, 2, ctx),
  },
  {
    id: 'autumn',
    simple: { color: rgb(255, 80, 0) },
    template: { style: 'leaves', bg: AUTUMN_BG, colors: LEAVES, size: 'medium', speed: 55 },
    melk: { color: rgb(255, 80, 0) },
    label: 'Automne',
    colors: [AUTUMN_BG, ...LEAVES],
    build: (ctx) => leavesScript(AUTUMN_BG, LEAVES, ctx),
  },
  {
    id: 'aurora',
    simple: { color: rgb(90, 0, 255) },
    template: { style: 'bands', bg: AURORA_BG, colors: AURORA, size: 'medium', speed: 45 },
    melk: { effect: 204, speed: 40 },
    label: 'Aurore',
    colors: [AURORA_BG, ...AURORA],
    // Deux larges bandes, bleu clair et violette, qui glissent sur un bleu nuit (« magnifique »).
    build: (ctx) =>
      bandsScript(
        AURORA_BG,
        [
          { color: AURORA[0], width: 34, ramp: 7, offset: 0 },
          { color: AURORA[1], width: 30, ramp: 7, offset: Math.round(ctx.n / 2) },
        ],
        ctx,
        110,
      ),
  },
  {
    id: 'romantic',
    simple: { color: rgb(255, 0, 40) },
    template: { style: 'bands', bg: ROMANTIC_BG, colors: [ROMANTIC, ROMANTIC], size: 'large', speed: 36 },
    // Flot (35), choisi par Guillaume « de loin » : même esprit que la Forêt, dans la couleur romantique.
    melk: { effect: 35, speed: 60 },
    label: 'Romantique',
    colors: [ROMANTIC_BG, ROMANTIC],
    // Deux bandes rouge profond / fuchsia qui glissent sur un vin sombre (Guillaume : « que du rose qui se balade »).
    build: (ctx) =>
      bandsScript(
        ROMANTIC_BG,
        [
          { color: ROMANTIC, width: 34, ramp: 8, offset: 0 },
          { color: ROMANTIC, width: 34, ramp: 8, offset: Math.round(ctx.n / 2) },
        ],
        ctx,
        120,
      ),
  },
  {
    id: 'ocean',
    simple: { color: rgb(0, 60, 255) },
    template: { style: 'glows', bg: OCEAN_BG, colors: [PLANKTON], size: 'medium', speed: 40 },
    // Impulsion bleue profonde (207) : le flot cyan (33) faisait trop turquoise à côté de l'Océan Wi-Fi.
    melk: { effect: 207, speed: 60 },
    label: 'Océan',
    colors: [OCEAN_BG, PLANKTON],
    // Plancton : de petites lueurs cyan qui naissent et s'éteignent (plus lentes, à la demande de Guillaume).
    build: (ctx) => glowScript(OCEAN_BG, PLANKTON, [0.3, 0.7, 1, 0.7, 0.3], ctx, 14, 80),
  },
  {
    id: 'miami',
    simple: { color: rgb(255, 0, 160) },
    template: { style: 'bands', bg: MIAMI_BG, colors: [MIAMI[0], MIAMI[1], MIAMI[0], MIAMI[1]], size: 'large', speed: 100 },
    // Effet « Flash » (53), préféré par Guillaume aux blocs rose-bleu-cyan (8).
    melk: { effect: 53, speed: 60 },
    label: 'Miami',
    colors: [MIAMI[0], MIAMI_BG, MIAMI[1]],
    // Dégradé synthwave rose / turquoise qui glisse sur un violet (finale gagnée contre l'enseigne néon : « il tue »).
    // Sans pré-remplissage : quatre bandes longues, le fichier doit rester court.
    build: (ctx) =>
      bandsScript(
        MIAMI_BG,
        [MIAMI[0], MIAMI[1], MIAMI[0], MIAMI[1]].map((color, i) => ({ color, width: 38, ramp: 9, offset: Math.round((i * ctx.n) / 4) })),
        ctx,
        50,
        false,
      ),
  },
  {
    id: 'forest',
    simple: { color: rgb(0, 200, 0) },
    template: { style: 'bands', bg: FOREST_BG, colors: FOREST, size: 'medium', speed: 45 },
    melk: { effect: 27, speed: 60 },
    label: 'Forêt',
    colors: [FOREST_BG, ...FOREST],
    // Lumière qui passe entre les feuilles : deux bandes vertes sur un vert sombre (« j'aime beaucoup »).
    build: (ctx) =>
      bandsScript(
        FOREST_BG,
        [
          { color: FOREST[0], width: 36, ramp: 9, offset: 0 },
          { color: FOREST[1], width: 30, ramp: 8, offset: Math.round(ctx.n / 2) },
        ],
        ctx,
        110,
      ),
  },
];

/** Les couleurs à montrer pour une ambiance (petite rangée de LED, widgets). */
export const ambianceColors = (a: Pick<Ambiance, 'colors' | 'motif' | 'creation'>): Rgb[] => a.creation?.colors ?? a.motif?.pixels ?? a.colors;

