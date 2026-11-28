import AsyncStorage from '@react-native-async-storage/async-storage';

/** Préfixe des clés d'avant le nom définitif de l'appli : relu une fois, puis recopié sous la nouvelle clé. */
const LEGACY_PREFIX = 'rubanix.';
const PREFIX = 'ledstrip.';

/**
 * Lit une valeur enregistrée sur le téléphone. Si elle n'existe que sous l'ancienne clé (versions ≤ 1.1),
 * elle est recopiée sous la nouvelle et l'ancienne effacée : rien ne se perd à la mise à jour.
 */
export async function getStored(key: string): Promise<string | null> {
  const value = await AsyncStorage.getItem(key).catch(() => null);
  if (value !== null || !key.startsWith(PREFIX)) return value;
  const legacy = LEGACY_PREFIX + key.slice(PREFIX.length);
  const old = await AsyncStorage.getItem(legacy).catch(() => null);
  if (old !== null) {
    await AsyncStorage.setItem(key, old).catch(() => undefined);
    await AsyncStorage.removeItem(legacy).catch(() => undefined);
  }
  return old;
}
