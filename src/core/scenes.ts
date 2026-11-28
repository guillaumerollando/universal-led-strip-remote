/**
 * Ambiances de pièce : l'état de chaque ruban d'une pièce, rappelé d'un geste. Celles de l'utilisateur sont une
 * photo de la pièce telle qu'il l'a réglée ; celles de l'appli donnent une intention (couleur, luminosité, effet)
 * que chaque ruban suit selon ce qu'il sait faire. Pur : `services/scenes.ts` enregistre et envoie.
 */
import type { IrKey } from './ir';
import { AMBIANCE_EFFECT_PREFIX } from './protocols/openbeken';
import type { Rgb } from './protocols/types';

/** Ce qu'un ruban doit faire dans une ambiance de pièce. */
export interface SceneItem {
  key: string;
  on: boolean;
  rgb?: Rgb;
  brightness?: number;
  effect?: string;
  speed?: number;
  /** Motif d'un ruban à pixels (texte de `encodeMotif`). */
  motif?: string;
  /** Création « Créer mon ambiance » d'un ruban à pixels (texte de `encodeCreation`). */
  creation?: string;
}

export interface RoomScene {
  id: string;
  roomId: string;
  /** Libellé français (traduit à l'affichage) pour celles de l'appli ; nom choisi sinon. */
  name: string;
  items: SceneItem[];
  mine?: boolean;
}

/** État retenu d'un ruban (forme de `SavedDevice`, sans dépendre du stockage). */
export interface SceneSource {
  key: string;
  state?: { on?: boolean; rgb?: Rgb; brightness?: number; effect?: string; speed?: number };
  meta?: Record<string, string>;
}

/** Photo de la pièce : chaque ruban garde son état actuel (et son motif s'il en joue un). */
export function captureScene(roomId: string, name: string, devices: SceneSource[], id = `scene-${Date.now()}`): RoomScene {
  return {
    id,
    roomId,
    name: name.trim(),
    mine: true,
    items: devices.map((d) => ({
      key: d.key,
      on: d.state?.on ?? false,
      rgb: d.state?.rgb,
      brightness: d.state?.brightness,
      effect: d.state?.effect,
      speed: d.state?.speed,
      motif: d.state?.effect === 'obk-motif' ? d.meta?.motif : undefined,
      creation: d.state?.effect === 'obk-creation' ? d.meta?.creation : undefined,
    })),
  };
}

/** Ambiances de pièce livrées : une intention que chaque ruban suit à sa façon. */
export interface PresetScene {
  id: string;
  name: string;
  rgb: Rgb;
  brightness: number;
  /** Ambiance de l'appli (`ambiances.ts`) à jouer si le ruban la connaît. */
  ambiance?: string;
  /** Effets à essayer ensuite dans l'ordre (le premier que le ruban connaît) ; sinon la couleur. */
  effects?: string[];
}

/**
 * Trois ambiances bien distinctes (choix de Guillaume, 2026-11-27) : on garde les identifiants d'avant
 * (`cosy`, `cinema`, `party`) pour que les widgets déjà posés continuent de marcher.
 */
export const PRESET_SCENES: PresetScene[] = [
  { id: 'cosy', name: 'Cocooning', ambiance: 'autumn', rgb: { r: 255, g: 80, b: 0 }, brightness: 60 },
  { id: 'cinema', name: 'Relaxation', ambiance: 'aurora', rgb: { r: 60, g: 0, b: 200 }, brightness: 40 },
  { id: 'party', name: 'Fiesta', rgb: { r: 255, g: 0, b: 160 }, brightness: 100, effects: ['obk-rainbow', 'rainbow', 'smooth', 'jump7', 'fade7', 'blink7'] },
];

/**
 * Applique une intention de l'appli à un ruban : ce qu'il saura faire (l'ambiance s'il la connaît, sinon un effet
 * connu, sinon la couleur).
 */
export function presetItem(preset: PresetScene, key: string, knownEffects: string[], knownAmbiances: string[] = []): SceneItem {
  if (preset.ambiance && knownAmbiances.includes(preset.ambiance)) return { key, on: true, effect: AMBIANCE_EFFECT_PREFIX + preset.ambiance };
  const effect = preset.effects?.find((e) => knownEffects.includes(e));
  return effect ? { key, on: true, effect, brightness: preset.brightness, speed: 55 } : { key, on: true, rgb: preset.rgb, brightness: preset.brightness };
}

const dist = (a: Rgb, b: Rgb): number => (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;

/** Ruban infrarouge : la touche de couleur de sa télécommande la plus proche de la couleur voulue. */
export function nearestColorKey(keys: IrKey[], rgb: Rgb): IrKey | undefined {
  return keys
    .filter((k) => k.kind === 'color' && k.rgb)
    .reduce<IrKey | undefined>((best, k) => (!best || dist(k.rgb!, rgb) < dist(best.rgb!, rgb) ? k : best), undefined);
}
