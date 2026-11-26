import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** Astuce « appui long » : montrée sur l'accueil jusqu'au premier appui long (ou « Compris »), une fois pour toutes. */
const KEY = 'rubanix.hint.longpress.v1';
let seen = true; // caché tant qu'on n'a pas lu le téléphone (pas de clignotement au démarrage)
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

void AsyncStorage.getItem(KEY)
  .then((v) => {
    seen = v === '1';
    emit();
  })
  .catch(() => undefined);

export function markLongPressSeen(): void {
  if (seen) return;
  seen = true;
  emit();
  void AsyncStorage.setItem(KEY, '1').catch(() => undefined);
}

export function useLongPressHint(): boolean {
  return !useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => seen,
  );
}
