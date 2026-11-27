/**
 * Ruban OpenBeken : ce qui demande plusieurs requêtes (lire ses pilotes, écrire un script, garder l'effet au
 * démarrage). Les commandes elles-mêmes sont dans `core/protocols/openbeken.ts`.
 */
import {
  MOTIF_FILE,
  MOTIF_FILE_NAMES,
  OBK_AUTOEXEC,
  OBK_BEFORE_SCRIPT,
  OBK_LAUNCH_SCRIPT,
  OBK_STARTUP_SCRIPT,
  OBK_STATE,
  obkAnimCommands,
  obkAnimStartup,
  obkCmd,
  obkDeleteFile,
  obkDrivers,
  obkFileNames,
  OBK_LIST_FILES,
  obkPixelCount,
  obkReadFile,
  obkWriteFile,
  withStartupEffect,
} from '../core/protocols/openbeken';
import type { Rgb } from '../core/protocols/types';
import { http } from './net';
import { t as tr } from '../i18n';

/** Nombre de LED par défaut quand l'autoexec ne le dit pas (le motif boucle alors un peu trop tôt). */
const DEFAULT_PIXELS = 100;

const readText = async (ip: string, file: string): Promise<string> => {
  const r = await http(ip, obkReadFile(file), 2500).catch(() => '');
  return typeof r === 'string' ? r : '';
};

/** `{ pixels: '200' }` pour un ruban à pixels (pilote SM16703P actif), `{}` sinon. */
export async function obkPixelMeta(ip: string): Promise<Record<string, string>> {
  const page = await http(ip, OBK_STATE, 2500).catch(() => '');
  if (!obkDrivers(typeof page === 'string' ? page : '').includes('SM16703P')) return {};
  return { pixels: String(obkPixelCount(await readText(ip, OBK_AUTOEXEC)) ?? DEFAULT_PIXELS) };
}

/**
 * Une opération à la fois par ruban : deux écritures de script qui se croisent (effacer, écrire, lancer) laissent
 * le ruban sans fichier ou le font décrocher (« pas de réponse » en glissant le ruban-curseur, 2026-11-27).
 */
const queues = new Map<string, Promise<unknown>>();
function exclusive<T>(ip: string, job: () => Promise<T>): Promise<T> {
  const before = queues.get(ip) ?? Promise.resolve();
  const run = before.catch(() => undefined).then(job);
  queues.set(ip, run.catch(() => undefined));
  return run;
}

export async function obkRun(ip: string, cmds: string[]): Promise<void> {
  for (const c of cmds) await http(ip, obkCmd(c));
}

/** Retient l'effet dans `autoexec.bat` pour qu'il revienne après une coupure de courant. Échec silencieux. */
async function keepAtStartup(ip: string, cmds: string[]): Promise<void> {
  try {
    const current = await http(ip, obkReadFile(OBK_AUTOEXEC), 4000);
    // Jamais réécrire sans l'avoir bien lu : un ruban occupé a déjà renvoyé un fichier vide, et l'appli avait
    // effacé les lignes qui démarrent les LED (2026-11-27). Sans « SM16703P_Init », on ne touche à rien.
    if (typeof current !== 'string' || !/SM16703P_Init/i.test(current)) return;
    const next = withStartupEffect(current, cmds);
    if (next !== current) await http(ip, obkWriteFile(OBK_AUTOEXEC, next));
  } catch {
    // Le ruban marche quand même ; il perdra juste l'effet à la prochaine coupure.
  }
}

export function obkAnim(ip: string, code: number, speedPercent: number, rgb?: Rgb): Promise<void> {
  return exclusive(ip, () => obkAnimNow(ip, code, speedPercent, rgb));
}
async function obkAnimNow(ip: string, code: number, speedPercent: number, rgb?: Rgb): Promise<void> {
  await obkRun(ip, obkAnimCommands(code, speedPercent, rgb));
  await keepAtStartup(ip, obkAnimStartup(code, speedPercent, rgb));
}

/**
 * Envoie et lance un script (ambiance ou motif dessiné) : toujours un seul fichier court. Le ruban est d'abord
 * préparé (cache vidé, animation intégrée coupée, journal réduit), puis le script est gardé au démarrage,
 * lancé 5 s après (sinon l'affichage se fige).
 */
export function obkScript(ip: string, lines: string[]): Promise<void> {
  return exclusive(ip, () => obkScriptNow(ip, lines));
}
async function obkScriptNow(ip: string, lines: string[]): Promise<void> {
  const text = lines.join('\n') + '\n';
  await obkRun(ip, OBK_BEFORE_SCRIPT);
  // La mémoire du ruban est petite : on efface l'ancien script (et les morceaux des anciennes versions) d'abord.
  // Seulement les fichiers présents : le ruban ne répond rien pour un fichier absent, et chaque essai coûtait un délai.
  const present = obkFileNames(await http(ip, OBK_LIST_FILES, 2500).catch(() => null));
  for (const name of MOTIF_FILE_NAMES.filter((n) => present.includes(n))) await http(ip, obkDeleteFile(name)).catch(() => undefined);
  const reply = (await http(ip, obkWriteFile(MOTIF_FILE, text))) as { size?: number } | null;
  // Mémoire pleine : le ruban répond « taille 0 » sans erreur.
  if (reply?.size !== undefined && reply.size < text.length) throw new Error(tr('La mémoire du ruban est pleine.'));
  await obkRun(ip, OBK_LAUNCH_SCRIPT);
  await keepAtStartup(ip, OBK_STARTUP_SCRIPT);
}

/** Couleur unie : on arrête animations et motif, et on n'en relance plus au démarrage. */
export function obkStopEffects(ip: string): Promise<void> {
  return exclusive(ip, () => obkStopEffectsNow(ip));
}
async function obkStopEffectsNow(ip: string): Promise<void> {
  await obkRun(ip, ['stopAllScripts', 'Anim -1']);
  await keepAtStartup(ip, []);
}

/**
 * Repère la fin du ruban : tout éteint sauf la dernière LED (blanche) et celle d'avant (bleue). L'utilisateur ajuste
 * la longueur jusqu'à voir le blanc tout au bout (« Créer mon ambiance »).
 */
export function obkShowEnd(ip: string, length: number): Promise<void> {
  return exclusive(ip, () => obkShowEndNow(ip, length));
}
async function obkShowEndNow(ip: string, length: number): Promise<void> {
  await obkRun(ip, [
    'stopAllScripts',
    'stopDriver PixelAnim',
    'SM16703P_SetPixel all 0 0 0',
    `SM16703P_SetPixel ${Math.max(0, length - 2)} 0 0 255`,
    `SM16703P_SetPixel ${length - 1} 255 255 255`,
    'SM16703P_Start',
  ]);
}
