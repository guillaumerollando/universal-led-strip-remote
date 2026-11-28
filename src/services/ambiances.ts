import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStored } from './storage';
import { useEffect, useSyncExternalStore } from 'react';

import type { Ambiance } from '../core/ambiances';
import { DEFAULTS, type Creation } from '../core/creations';
import { normalizeMotif } from '../core/protocols/openbeken';
import { safeParse } from './safeParse';

/** Ambiances enregistrées par l'utilisateur : sur le téléphone seulement, pour tous ses rubans à pixels. */
const KEY = 'ledstrip.ambiances.v1';
let mine: Ambiance[] = [];
const listeners = new Set<() => void>();

const set = (next: Ambiance[]): void => {
  mine = next;
  listeners.forEach((l) => l());
};
const persist = (): Promise<void> => AsyncStorage.setItem(KEY, JSON.stringify(mine));

/**
 * Lecture du téléphone, une seule fois : les appelants suivants attendent la même lecture (avant, un second appel
 * repartait aussitôt avec une liste vide).
 */
let loading: Promise<void> | undefined;
const load = (): Promise<void> => (loading ??= readStored());
async function readStored(): Promise<void> {
  const text = await getStored(KEY);
  if (text) {
    // Ambiances de l'utilisateur : des créations. Les anciennes (motif dessiné) sont converties en style « Motif ».
    const saved = safeParse<Ambiance[]>(text, []).filter((a) => a.creation || a.motif);
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
