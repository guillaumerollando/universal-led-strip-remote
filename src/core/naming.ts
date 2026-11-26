/**
 * Petits outils sans React pour l'ajout d'un ruban : nom proposé par défaut et force du signal en mots.
 */

const norm = (s: string): string => s.trim().toLocaleLowerCase();

/**
 * Premier nom libre de la forme `format(n)` (n = 1, 2, 3…) : on propose toujours un nom, pour ne jamais bloquer
 * l'ajout, sans doublon avec les rubans déjà là (casse et espaces ignorés).
 */
export function nextFreeName(existing: readonly string[], format: (n: number) => string): string {
  const taken = new Set(existing.map(norm));
  for (let n = 1; ; n++) {
    const name = format(n);
    if (!taken.has(norm(name))) return name;
  }
}

export type SignalLevel = 'near' | 'range' | 'far';

/** Force du signal Bluetooth en trois niveaux (le RSSI en dBm ne parle à personne). */
export function signalLevel(rssi?: number | null): SignalLevel | null {
  if (rssi === undefined || rssi === null) return null;
  if (rssi > -65) return 'near';
  if (rssi > -80) return 'range';
  return 'far';
}
