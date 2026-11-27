import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Favoris : les ambiances (de ruban ou de pièce) que l'utilisateur veut avoir sous la main. Sur le téléphone
 * seulement. Identifiants : `amb:<id>` pour une ambiance de ruban, `scene:<id>` pour une ambiance de pièce.
 */
const KEY = 'rubanix.favorites.v1';
let favorites: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const set = (next: string[]): void => {
  favorites = next;
  listeners.forEach((l) => l());
};

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const text = await AsyncStorage.getItem(KEY).catch(() => null);
  if (text) set(JSON.parse(text) as string[]);
}

export const ambianceFav = (id: string): string => `amb:${id}`;
export const sceneFav = (id: string): string => `scene:${id}`;
export const isFavorite = (key: string): boolean => favorites.includes(key);
export const getFavorites = (): string[] => favorites;

export async function toggleFavorite(key: string): Promise<void> {
  await load();
  set(favorites.includes(key) ? favorites.filter((k) => k !== key) : [...favorites, key]);
  await AsyncStorage.setItem(KEY, JSON.stringify(favorites));
}

export const subscribeFavorites = (l: () => void): (() => void) => {
  listeners.add(l);
  void load();
  return () => listeners.delete(l);
};

/** Les favoris, dans l'ordre où ils ont été ajoutés. */
export function useFavorites(): string[] {
  useEffect(() => void load(), []);
  return useSyncExternalStore(subscribeFavorites, () => favorites);
}

/** Met les favoris en tête, sans changer l'ordre du reste. */
export function favoritesFirst<T>(items: T[], keyOf: (item: T) => string, favs: string[]): T[] {
  return [...items.filter((i) => favs.includes(keyOf(i))), ...items.filter((i) => !favs.includes(keyOf(i)))];
}
