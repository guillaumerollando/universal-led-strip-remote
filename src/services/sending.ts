import { useSyncExternalStore } from 'react';

/**
 * Envois en cours vers chaque ruban, par nature (allumer, luminosité, couleur, effet) : l'interface montre que le
 * ruban va suivre (contour qui tourne, `ui/LoadingBorder`) là où l'action est partie.
 */
export type SendKind = 'power' | 'brightness' | 'color' | 'effect';

let pending: Record<string, number> = {};
const listeners = new Set<() => void>();
const bump = (id: string, d: number): void => {
  pending = { ...pending, [id]: Math.max(0, (pending[id] ?? 0) + d) };
  listeners.forEach((l) => l());
};

/** Retient l'envoi le temps qu'il dure. */
export async function track<T>(key: string, kind: SendKind, p: Promise<T>): Promise<T> {
  bump(`${key}|${kind}`, 1);
  try {
    return await p;
  } finally {
    bump(`${key}|${kind}`, -1);
  }
}

/** Un envoi vers ce ruban est-il en cours (d'une de ces natures, ou de n'importe laquelle) ? */
const ALL: SendKind[] = ['power', 'brightness', 'color', 'effect'];
export function useSending(key: string | undefined, kinds: SendKind[] = ALL): boolean {
  // Un booléen par ruban : un envoi vers un ruban ne redessine pas les cases des autres.
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => !!key && kinds.some((k) => (pending[`${key}|${k}`] ?? 0) > 0),
  );
}
