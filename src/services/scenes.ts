import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStored } from './storage';
import { useEffect, useSyncExternalStore } from 'react';

import { nearestColorKey, presetItem, PRESET_SCENES, type PresetScene, type RoomScene, type SceneItem } from '../core/scenes';
import { decodeMotif } from '../core/protocols/openbeken';
import {
  ambiancesFor,
  canColor,
  canDim,
  catalogFor,
  canPower,
  effectsFor,
  irRemoteOf,
  pressIrKey,
  setBrightness,
  setColor,
  setEffect,
  setMotif,
  setAmbiance,
  setCreation,
  setPower,
  type GroupResult,
} from './control';
import { AMBIANCE_EFFECT_PREFIX } from '../core/protocols/openbeken';
import { decodeCreation } from '../core/creations';
import { getDevice, rememberState, type SavedDevice } from './store';
import { safeParse } from './safeParse';

/** Ambiances de pièce enregistrées par l'utilisateur (sur le téléphone). */
const KEY = 'ledstrip.scenes.v1';
let scenes: RoomScene[] = [];
const listeners = new Set<() => void>();
const set = (next: RoomScene[]): void => {
  scenes = next;
  listeners.forEach((l) => l());
};
const persist = (): Promise<void> => AsyncStorage.setItem(KEY, JSON.stringify(scenes));

/**
 * Ambiances proposées par l'appli que l'utilisateur ne veut plus voir dans une pièce (`pièce:ambiance`) : on propose
 * au début pour ne pas laisser de vide, mais chacun garde seulement ce qui lui plaît (Guillaume, 2026-11-27).
 */
const HIDDEN_KEY = 'ledstrip.scenes.hidden.v1';
let hidden: string[] = [];
const hiddenId = (roomId: string, presetId: string): string => `${roomId}:${presetId}`;

/**
 * Lecture du téléphone, une seule fois : les appelants suivants attendent la même lecture (avant, un second appel
 * repartait aussitôt avec une liste vide).
 */
let loading: Promise<void> | undefined;
const load = (): Promise<void> => (loading ??= readStored());
async function readStored(): Promise<void> {
  const [text, hiddenText] = await Promise.all([getStored(KEY), getStored(HIDDEN_KEY)]);
  hidden = safeParse<string[]>(hiddenText, []);
  const saved = safeParse<RoomScene[] | null>(text, null);
  if (saved) set(saved);
  else listeners.forEach((l) => l());
}

/** Ne plus proposer cette ambiance de l'appli dans cette pièce. */
export async function hidePreset(roomId: string, presetId: string): Promise<void> {
  await load();
  hidden = [...hidden.filter((h) => h !== hiddenId(roomId, presetId)), hiddenId(roomId, presetId)];
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
}
/** Remet toutes les ambiances proposées dans cette pièce. */
export async function restorePresets(roomId: string): Promise<void> {
  await load();
  hidden = hidden.filter((h) => !h.startsWith(`${roomId}:`));
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
}
/** Les ambiances de l'appli encore proposées dans cette pièce. */
export const presetsOf = (roomId: string): PresetScene[] => PRESET_SCENES.filter((p) => !hidden.includes(hiddenId(roomId, p.id)));
/** Des ambiances proposées ont-elles été retirées de cette pièce ? */
export const hasHiddenPresets = (roomId: string): boolean => hidden.some((h) => h.startsWith(`${roomId}:`));
/** Pour les composants : se redessiner quand les ambiances proposées changent. */
export function usePresetsOf(roomId: string): PresetScene[] {
  useEffect(() => void load(), []);
  const h = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => hidden,
  );
  return PRESET_SCENES.filter((p) => !h.includes(hiddenId(roomId, p.id)));
}

export async function saveScene(scene: RoomScene): Promise<void> {
  await load();
  set([...scenes, scene]);
  await persist();
}

export async function removeScene(id: string): Promise<void> {
  set(scenes.filter((s) => s.id !== id));
  await persist();
}

/** Retrouve une ambiance de pièce (de l'appli ou de l'utilisateur) : pour les liens des widgets. */
export async function findScene(sceneId: string): Promise<RoomScene | PresetScene | undefined> {
  await load();
  return scenes.find((s) => s.id === sceneId) ?? PRESET_SCENES.find((p) => p.id === sceneId);
}

/** Les ambiances retenues de toutes les pièces (synchro des widgets). */
export const allScenes = (): RoomScene[] => scenes;
export const subscribeScenes = (l: () => void): (() => void) => {
  listeners.add(l);
  void load();
  return () => listeners.delete(l);
};

export function useRoomScenes(roomId: string | undefined): RoomScene[] {
  useEffect(() => void load(), []);
  const all = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => scenes,
  );
  return roomId ? all.filter((s) => s.roomId === roomId) : [];
}

/** Les effets qu'un ruban connaît (ceux de son contrôleur, ou les touches d'effet de sa télécommande). */
function knownEffects(d: SavedDevice): string[] {
  const ir = irRemoteOf(d);
  if (ir) return ir.keys.filter((k) => k.kind === 'effect').map((k) => k.id);
  return effectsFor(d).map((e) => e.id);
}

/**
 * Met un ruban dans l'état voulu, avec ce qu'il sait faire. Un seul envoi lent par ruban à pixels : son script n'est
 * ni relancé ni réécrit pour rien avant d'être remplacé. Un ruban oublié entre-temps est simplement passé.
 */
async function applyItem(item: SceneItem): Promise<void> {
  const fresh = (): SavedDevice | undefined => getDevice(item.key);
  const d = fresh();
  if (!d || !canPower(d)) return;
  if (!item.on) return setPower(d, false);

  // Ambiance de l'appli : `setAmbiance` sait la jouer partout (ruban à pixels, MELK, couleur, télécommande).
  // La luminosité est retenue d'abord : le script de l'ambiance la prend.
  if (item.effect?.startsWith(AMBIANCE_EFFECT_PREFIX)) {
    if (item.brightness !== undefined && canDim(d)) await rememberState(item.key, { brightness: item.brightness });
    const now = fresh();
    if (now) await setAmbiance(now, item.effect.slice(AMBIANCE_EFFECT_PREFIX.length));
    return;
  }

  const ir = irRemoteOf(d);
  if (ir) {
    // Infrarouge : on allume, puis la touche d'effet, sinon la couleur la plus proche de la télécommande.
    if (!d.state?.on) await setPower(d, true);
    const effectKey = item.effect ? ir.keys.find((k) => k.kind === 'effect' && k.id === item.effect) : undefined;
    const key = effectKey ?? (item.rgb ? nearestColorKey(ir.keys, item.rgb) : undefined);
    const now = fresh();
    if (key && now) await pressIrKey(now, key);
    return;
  }

  if (item.speed !== undefined) await rememberState(item.key, { speed: item.speed });
  const creation = decodeCreation(item.creation);
  const motif = decodeMotif(item.motif);
  if (creation || motif) {
    // Script (création, dessin) : luminosité retenue puis script envoyé une seule fois, sans rallumer l'ancien.
    if (item.brightness !== undefined && canDim(d)) await rememberState(item.key, { brightness: item.brightness });
    const now = fresh();
    if (!now) return;
    if (creation) await setCreation(now, creation);
    else if (motif) await setMotif(now, motif, item.speed);
    return;
  }

  await setPower(d, true);
  const effect = item.effect ? [...effectsFor(d), ...catalogFor(d)].find((e) => e.id === item.effect) : undefined;
  const dim = async (): Promise<void> => {
    const now = fresh();
    if (now && item.brightness !== undefined && canDim(d)) await setBrightness(now, item.brightness);
  };
  if (effect) {
    // Luminosité avant l'effet : sur certains contrôleurs, elle s'envoie comme une couleur et couperait l'effet.
    await dim();
    const now = fresh();
    if (now) await setEffect(now, effect, item.rgb, item.speed);
  } else {
    const now = fresh();
    if (now && item.rgb && canColor(d)) await setColor(now, item.rgb);
    // Après la couleur : un ancien script est déjà arrêté, la luminosité n'a pas à le réécrire.
    await dim();
  }
}

/**
 * Applique une ambiance à la pièce : ruban par ruban (le Bluetooth gère mal plusieurs connexions, l'infrarouge n'a
 * qu'un émetteur). Un ruban qui ne répond pas n'arrête pas les autres.
 */
export async function applyScene(items: SceneItem[]): Promise<GroupResult> {
  const result: GroupResult = { ok: [], failed: [] };
  for (const item of items) {
    try {
      await applyItem(item);
      result.ok.push(item.key);
    } catch (e) {
      result.failed.push({ key: item.key, message: (e as Error).message });
    }
  }
  return result;
}

/** Une ambiance de l'appli, traduite pour chaque ruban de la pièce. */
export const presetItems = (preset: PresetScene, devices: SavedDevice[]): SceneItem[] =>
  devices.filter(canPower).map((d) => presetItem(preset, d.key, knownEffects(d), irRemoteOf(d) ? [] : ambiancesFor(d)));

/**
 * Ambiance de pièce en cours : celle qu'on a touchée en dernier, tant que les rubans de la pièce sont restés dans
 * l'état où elle les a mis (on change une couleur, la pièce n'est plus « dans » l'ambiance). Retenue sur le téléphone.
 */
const APPLIED_KEY = 'ledstrip.scenes.applied.v1';
let applied: Record<string, { sceneId: string; snapshot: string }> = {};
let appliedLoaded = false;
const appliedListeners = new Set<() => void>();
const lightState = (devices: SavedDevice[]): string =>
  devices
    .map((d) => {
      const s = d.state ?? {};
      return `${d.key}:${s.on ? 1 : 0}:${s.rgb ? `${s.rgb.r},${s.rgb.g},${s.rgb.b}` : ''}:${s.effect ?? ''}:${s.brightness ?? ''}`;
    })
    .join('|');

async function loadApplied(): Promise<void> {
  if (appliedLoaded) return;
  appliedLoaded = true;
  const text = await getStored(APPLIED_KEY);
  if (text) {
    applied = safeParse<typeof applied>(text, {});
    appliedListeners.forEach((l) => l());
  }
}

/** Retient l'ambiance qu'on vient d'appliquer à la pièce, avec l'état des rubans qu'elle a laissé. */
export function markApplied(roomId: string, sceneId: string, deviceKeys: string[]): void {
  const now = deviceKeys.map((k) => getDevice(k)).filter((d): d is SavedDevice => !!d);
  applied = { ...applied, [roomId]: { sceneId, snapshot: lightState(now) } };
  appliedListeners.forEach((l) => l());
  void AsyncStorage.setItem(APPLIED_KEY, JSON.stringify(applied));
}

/** L'ambiance dans laquelle la pièce se trouve, s'il y en a une. */
export function useActiveScene(roomId: string, devices: SavedDevice[]): string | undefined {
  useEffect(() => void loadApplied(), []);
  const all = useSyncExternalStore(
    (l) => {
      appliedListeners.add(l);
      return () => appliedListeners.delete(l);
    },
    () => applied,
  );
  const a = all[roomId];
  return a && a.snapshot === lightState(devices) ? a.sceneId : undefined;
}
