/**
 * OpenBeken (github.com/openshwprojects/OpenBK7231T_App) : micrologiciel libre des puces Beken / Tuya, installé à la
 * place du logiciel Tuya (par Wi-Fi avec tuya-cloudcutter). Il parle le langage Tasmota (`/cm?cmnd=…`) et, pour les
 * rubans à pixels (pilote SM16703P, compatible WS2812), il ajoute :
 * - 6 animations intégrées (`Anim n`, `AnimSpeed n`, pilote PixelAnim) ;
 * - de petits scripts qui tournent dans le ruban : c'est ainsi qu'on fait défiler un motif pixel par pixel, même
 *   téléphone éteint ;
 * - `autoexec.bat`, lancé au démarrage : on y garde l'effet choisi pour qu'il revienne après une coupure.
 * Vérifié le 2026-11-27 sur le ruban LSC de Guillaume (BK7231N, 200 LED, OpenBeken 1.18.219).
 */
import { clamp, dim, type Effect, type HttpCall, type Rgb } from './types';

/** Une commande (envoyées une par une : on ne compte pas sur `Backlog`). */
export const obkCmd = (c: string): HttpCall => ({ method: 'GET', path: `/cm?cmnd=${encodeURIComponent(c)}` });

/** La page d'état courte : elle liste les pilotes actifs (« 3 drivers active (PixelAnim, SM16703P, DDP) »). */
export const OBK_STATE: HttpCall = { method: 'GET', path: '/index?state=1' };
export const OBK_AUTOEXEC = 'autoexec.bat';
export const obkReadFile = (name: string): HttpCall => ({ method: 'GET', path: `/api/lfs/${name}` });
/** Liste des fichiers du ruban : `{"dir":"","content":[{"name":"autoexec.bat","type":1,"size":43}…]}`. */
export const OBK_LIST_FILES: HttpCall = { method: 'GET', path: '/api/lfs/' };
export function obkFileNames(listing: unknown): string[] {
  const content = (listing as { content?: { name?: string; type?: number }[] } | null)?.content;
  return Array.isArray(content) ? content.filter((f) => f.type === 1 && typeof f.name === 'string').map((f) => f.name!) : [];
}
/** Supprime un fichier de la mémoire du ruban (réponse vide, même s'il n'existait pas). */
export const obkDeleteFile = (name: string): HttpCall => ({ method: 'GET', path: `/api/del/${name}` });
/** Écrit un fichier dans la mémoire du ruban (corps en texte brut). */
export const obkWriteFile = (name: string, text: string): HttpCall => ({ method: 'POST', path: `/api/lfs/${name}`, body: text });

/** La réponse à « Status 0 » vient-elle d'OpenBeken ? (version « OpenBK7231N_1.18.219 ») */
export function isOpenBeken(status: unknown): boolean {
  const v = (status as { StatusFWR?: { Version?: string } } | null)?.StatusFWR?.Version;
  return typeof v === 'string' && /^OpenBK/i.test(v);
}

/** Adresse MAC (clé stable : la box peut changer l'adresse IP du ruban). */
export function obkMac(status: unknown): string | undefined {
  const mac = (status as { StatusNET?: { Mac?: string } } | null)?.StatusNET?.Mac;
  return typeof mac === 'string' && /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac) ? mac.toUpperCase() : undefined;
}

/** Pilotes actifs lus sur la page d'état. */
export function obkDrivers(stateHtml: string): string[] {
  const m = /drivers? active \(([^)]*)\)/i.exec(stateHtml.replace(/<[^>]*>/g, ' '));
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/** Nombre de LED d'un ruban à pixels, lu dans `SM16703P_Init 200 BRG` (autoexec). */
export function obkPixelCount(autoexec: string): number | undefined {
  const m = /^\s*SM16703P_Init\s+(\d+)/im.exec(autoexec);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 && n <= 255 ? n : undefined;
}

// ── Effets ────────────────────────────────────────────────────────────────────────────

const R: Rgb = { r: 255, g: 0, b: 0 };
const O: Rgb = { r: 255, g: 100, b: 0 };
const Y: Rgb = { r: 255, g: 220, b: 0 };
const G: Rgb = { r: 0, g: 255, b: 0 };
const C: Rgb = { r: 0, g: 230, b: 255 };
const B: Rgb = { r: 0, g: 0, b: 255 };
const M: Rgb = { r: 255, g: 0, b: 200 };
const W: Rgb = { r: 255, g: 255, b: 255 };
const K: Rgb = { r: 0, g: 0, b: 0 };

/** Les animations intégrées, dans l'ordre d'OpenBeken (`code` = index pour `Anim`). */
export const OBK_ANIMS: Effect[] = [
  { id: 'obk-rainbow', label: 'Arc-en-ciel', code: 0, preview: [R, O, Y, G, C, B, M] },
  { id: 'obk-fire', label: 'Feu', code: 1, preview: [R, O, Y] },
  { id: 'obk-shooting-star', label: 'Étoile filante', code: 2, preview: [K, W, K] },
  { id: 'obk-comet', label: 'Comète', code: 3, preview: [K, C, W] },
  { id: 'obk-chase', label: 'Poursuite', code: 4, preview: [R, K, R] },
  { id: 'obk-chase-rainbow', label: 'Poursuite arc-en-ciel', code: 5, preview: [R, K, G, K, B] },
];

export const MOTIF_MAX = 20;
/** Effet en cours quand un motif (dessin de l'utilisateur) tourne dans le ruban. */
export const MOTIF_EFFECT_ID = 'obk-motif';
/** Effet en cours quand une création de l'utilisateur (« Créer mon ambiance ») tourne. */
export const CREATION_EFFECT_ID = 'obk-creation';
/** Effet en cours quand une ambiance de l'appli tourne : `obk-amb:<identifiant>`. */
export const AMBIANCE_EFFECT_PREFIX = 'obk-amb:';

/**
 * Comment le motif occupe le ruban :
 * - `snake` : un seul « serpent » qui parcourt le ruban éteint ;
 * - `flow` : répété tout le long, et qui avance d'un cran à la fois (comme la guirlande de Noël) ;
 * - `still` : répété tout le long, immobile.
 */
export type MotifMode = 'snake' | 'flow' | 'still';
export interface Motif {
  pixels: Rgb[];
  mode: MotifMode;
}

/** Vitesse 0-100 % → `AnimSpeed` (nombre de tours d'attente entre deux images : 0 = le plus rapide, 10 = lent). */
export const obkAnimSpeed = (percent: number): number => clamp((100 - clamp(percent, 0, 100)) / 10, 0, 10);

/** Le script qui tourne dans le ruban : toujours un seul fichier court (voir `core/obkScripts.ts`). */
export const MOTIF_FILE = 'ledstrip-motif.txt';
/** Anciennes versions : script coupé en plusieurs fichiers, à effacer s'ils traînent. */
export const MOTIF_FILE_NAMES = [MOTIF_FILE, 'ledstrip-motif-2.txt', 'ledstrip-motif-3.txt', 'ledstrip-motif-4.txt'];
/** Identifiant du fil de script du motif. */
const MOTIF_THREAD = 7;

/** Motif enregistré : couleurs hexadécimales séparées par des virgules, précédées de « * » (défile) ou « = » (fixe). */
const PREFIX: Record<MotifMode, string> = { snake: '', flow: '*', still: '=' };
export const encodeMotif = ({ pixels, mode }: Motif): string =>
  PREFIX[mode] +
  pixels.map(({ r, g, b }) => [r, g, b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')).join(',');
export function decodeMotif(text: string | undefined): Motif | undefined {
  const mode: MotifMode = (text ?? '').startsWith('*') ? 'flow' : (text ?? '').startsWith('=') ? 'still' : 'snake';
  const parts = (text ?? '').replace(/^[*=]/, '').split(',').filter((p) => /^[0-9a-f]{6}$/i.test(p));
  if (parts.length === 0) return undefined;
  const pixels = parts.slice(0, MOTIF_MAX).map((p) => ({ r: parseInt(p.slice(0, 2), 16), g: parseInt(p.slice(2, 4), 16), b: parseInt(p.slice(4, 6), 16) }));
  return { pixels, mode };
}

/** Ambiances enregistrées avant les trois modes (champ `repeat`) : on les relit. */
export function normalizeMotif(m: Motif | { pixels: Rgb[]; repeat?: boolean }): Motif {
  if ('mode' in m && m.mode) return { pixels: m.pixels, mode: m.mode };
  return { pixels: m.pixels, mode: (m as { repeat?: boolean }).repeat ? 'flow' : 'snake' };
}

/**
 * Préparer le ruban avant un script : vider le cache des scripts (OpenBeken ne relit jamais un fichier réécrit),
 * couper l'animation intégrée (elle redessinerait par-dessus) et réduire le journal (il écrivait une ligne par pixel).
 * Pas de `Power On` : le script dessine de lui-même, et « allumer » ramenait la couleur de base (blanche) sur tout le
 * ruban : un grand flash blanc à chaque changement d'ambiance (vu par Guillaume, 2026-11-27).
 */
export const OBK_BEFORE_SCRIPT = ['resetSVM', 'stopDriver PixelAnim', 'loglevel 1'];
export const OBK_START_SCRIPT = `startScript ${MOTIF_FILE} * ${MOTIF_THREAD}`;
/**
 * Lancer le script : couleur de base noire juste avant (le ruban la retient ; au démarrage il l'affiche pendant les
 * 5 s d'attente : noir plutôt que blanc éblouissant).
 */
export const OBK_LAUNCH_SCRIPT = ['Color 000000', OBK_START_SCRIPT];
/** Pour rallumer un motif après « éteindre » : le cache est encore bon. */
export const OBK_START_MOTIF = ['stopDriver PixelAnim', ...OBK_LAUNCH_SCRIPT];
/**
 * Au démarrage, attendre 5 s avant de lancer le script : lancé tout de suite après l'initialisation du ruban, le
 * premier envoi aux LED restait bloqué (`spi_dma_send_ TX_FINISH_FLAG`) et l'affichage se figeait (vu le 2026-11-27).
 */
export const OBK_STARTUP_SCRIPT = ['loglevel 1', `addRepeatingEvent 5 1 ${OBK_START_SCRIPT}`];

/** Commandes d'une animation intégrée. */
export const obkAnimCommands = (code: number, speedPercent: number, rgb?: Rgb): string[] => [
  'stopAllScripts',
  'loglevel 1',
  'startDriver PixelAnim',
  // Éteint côté ruban, une animation n'affiche rien (le ruban se croyait éteint : 4 ambiances muettes).
  'Power On',
  // La comète, l'étoile filante et la poursuite prennent la couleur de base : on la pose avant de lancer l'animation.
  ...(rgb ? [`Color ${[rgb.r, rgb.g, rgb.b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`] : []),
  `AnimSpeed ${obkAnimSpeed(speedPercent)}`,
  `Anim ${code}`,
];
/** Au démarrage : mêmes réglages, l'animation part 5 s après (même raison que les scripts). */
export const obkAnimStartup = (code: number, speedPercent: number, rgb?: Rgb): string[] => [
  ...obkAnimCommands(code, speedPercent, rgb).filter((c) => c !== 'stopAllScripts' && !c.startsWith('Anim ')),
  `addRepeatingEvent 5 1 Anim ${code}`,
];
/** Animations intégrées qui prennent la couleur choisie (les autres ont leurs propres couleurs). */
export const COLORED_ANIMS = ['obk-shooting-star', 'obk-comet', 'obk-chase'];

// ── Démarrage : l'effet choisi revient après une coupure de courant ─────────────────────

const BEGIN = '// ledstrip-remote: début';
const END = '// ledstrip-remote: fin';

/**
 * Réécrit `autoexec.bat` : garde tout ce que le propriétaire y a mis, remplace seulement le bloc de l'appli (entre
 * deux lignes de commentaire) par `effect` (vide = plus d'effet au démarrage). Le bloc va à la fin : après
 * l'initialisation du ruban.
 */
export function withStartupEffect(autoexec: string, effect: string[]): string {
  const own: string[] = [];
  let inside = false;
  for (const line of autoexec.split(/\r?\n/)) {
    if (line.trim() === BEGIN) inside = true;
    else if (line.trim() === END) inside = false;
    else if (!inside && line.trim() !== '') own.push(line);
  }
  const ours = effect.length > 0 ? [BEGIN, ...effect, END] : [];
  return [...own, ...ours].join('\n') + '\n';
}
