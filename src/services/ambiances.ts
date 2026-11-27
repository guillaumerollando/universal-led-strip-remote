import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import type { Ambiance } from '../core/ambiances';
import { DEFAULTS, type Creation } from '../core/creations';
import { normalizeMotif } from '../core/protocols/openbeken';

/** Ambiances enregistrées par l'utilisateur : sur le téléphone seulement, pour tous ses rubans à pixels. */
const KEY = 'rubanix.ambiances.v1';
let mine: Ambiance[] = [];
let loaded = false;
const listeners = new Set<() => void>();

const set = (next: Ambiance[]): void => {
  mine = next;
  listeners.forEach((l) => l());
};
const persist = (): Promise<void> => AsyncStorage.setItem(KEY, JSON.stringify(mine));

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const text = await AsyncStorage.getItem(KEY).catch(() => null);
  if (text) {
    // Ambiances de l'utilisateur : des créations. Les anciennes (motif dessiné) sont converties en style « Motif ».
    const saved = (JSON.parse(text) as Ambiance[]).filter((a) => a.creation || a.motif);
    set(
      saved.map((a) => {
        const creation: Creation =
          a.creation ?? { ...DEFAULTS, style: 'motif', colors: normalizeMotif(a.motif!).pixels, mode: normalizeMotif(a.motif!).mode, cell: 1, speed: a.speed ?? 55 };
        return { id: a.id, label: a.label, colors: creation.colors, creation, mine: true };
      }),
    );
  }
}

export async function saveAmbiance(name: string, creation: Creation): Promise<void> {
  await load();
  set([...mine, { id: `mine-${Date.now()}`, label: name.trim(), colors: creation.colors, creation, mine: true }]);
  await persist();
}

export async function removeAmbiance(id: string): Promise<void> {
  set(mine.filter((a) => a.id !== id));
  await persist();
}

export function useMyAmbiances(): Ambiance[] {
  useEffect(() => void load(), []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mine,
  );
}
