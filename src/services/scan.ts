import { useCallback, useSyncExternalStore } from 'react';

import type { DetectedDevice } from '../core/identify';
import { ensureBlePermissions, isBluetoothOn, scanBle } from './ble';
import { scanLan } from './lan';
import { t } from '../i18n';

export const SCAN_MS = 12_000;

interface ScanState {
  scanning: boolean;
  found: DetectedDevice[];
  warnings: string[];
}

let state: ScanState = { scanning: false, found: [], warnings: [] };
const listeners = new Set<() => void>();
const set = (patch: Partial<ScanState>): void => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

/** Retrouve un appareil du dernier scan (pour l'écran de détail d'un appareil pas encore enregistré). */
export function foundDevice(key: string): DetectedDevice | undefined {
  return state.found.find((d) => d.key === key);
}

/** Développement seulement (`ledstrip://dev-seed?scan=1`) : affiche des résultats de recherche de démonstration. */
export function showDemoScan(found: DetectedDevice[]): void {
  if (!__DEV__) return;
  set({ scanning: false, found, warnings: [] });
}

/** Lance un scan Bluetooth + Wi-Fi ; les appareils arrivent au fil de l'eau. */
export async function startScan(): Promise<void> {
  if (state.scanning) return;
  set({ scanning: true, found: [], warnings: [] });
  const add = (d: DetectedDevice): void => set({ found: [...state.found.filter((f) => f.key !== d.key), d] });
  const warn = (w: string): void => set({ warnings: state.warnings.includes(w) ? state.warnings : [...state.warnings, w] });

  if (!(await ensureBlePermissions())) warn(t('Bluetooth non autorisé : seuls les appareils Wi-Fi seront cherchés.'));
  else if (!(await isBluetoothOn())) warn(t('Le Bluetooth est éteint : allume-le pour trouver les rubans Bluetooth.'));
  else scanBle(add, SCAN_MS, (m) => warn(`Bluetooth : ${m}`));

  scanLan(add, SCAN_MS);
  setTimeout(() => set({ scanning: false }), SCAN_MS);
}

export function useScan(): ScanState & { start: () => void } {
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  const start = useCallback(() => void startScan(), []);
  return { ...snapshot, start };
}
