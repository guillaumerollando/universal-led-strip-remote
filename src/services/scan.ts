import { useCallback, useSyncExternalStore } from 'react';

import type { DetectedDevice } from '../core/identify';
import { ensureBlePermissions, isBluetoothOn, scanBle } from './ble';
import { scanLan } from './lan';
import { hueLightsOf, knownBridge } from './pairing';
import { getDevice, updateDevice } from './store';
import { sweepSubnet } from './sweep';
import { t } from '../i18n';

export const SCAN_MS = 12_000;
/**
 * Le Wi-Fi reste à l'écoute plus longtemps que le Bluetooth : certains contrôleurs (Tuya) ne font que s'annoncer
 * toutes les 5 s, et un téléphone en perd souvent une partie (vu sur le Redmi de Guillaume, 2026-11-27).
 * L'écoute s'arrête quand on quitte l'écran d'ajout (`stopScan`).
 */
const LAN_LISTEN_MS = 60_000;
/** Un appareil Wi-Fi vu il y a moins de 10 min reste proposé à la recherche suivante, même s'il ne s'est pas encore réannoncé. */
const RECENT_MS = 10 * 60_000;
const recentWifi = new Map<string, { device: DetectedDevice; at: number }>();
let stopLan: (() => void) | null = null;
let stopSweep: (() => void) | null = null;

interface ScanState {
  scanning: boolean;
  found: DetectedDevice[];
  warnings: string[];
  /** Résultats de démonstration affichés (développement) : la recherche automatique ne les efface pas. */
  demo?: boolean;
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
  set({ scanning: false, found, warnings: [], demo: true });
}

/** Ajoute ou remplace des appareils dans la liste (lampes d'un pont Hue autorisé, Nanoleaf avec son jeton). */
export function putFound(devices: DetectedDevice[]): void {
  const keys = new Set(devices.map((d) => d.key));
  set({ found: [...state.found.filter((f) => !keys.has(f.key)), ...devices] });
}

/** Lance un scan Bluetooth + Wi-Fi ; les appareils arrivent au fil de l'eau. */
export async function startScan(): Promise<void> {
  if (state.scanning) return;
  const now = Date.now();
  const recent = [...recentWifi.values()].filter((r) => now - r.at < RECENT_MS).map((r) => r.device);
  set({ scanning: true, found: recent, warnings: [], demo: false });
  const add = (d: DetectedDevice): void => {
    if (d.transport === 'wifi') recentWifi.set(d.key, { device: d, at: Date.now() });
    set({ found: [...state.found.filter((f) => f.key !== d.key), d] });
    // La box peut redonner une autre adresse IP à un ruban Wi-Fi : on suit sa nouvelle adresse (clé = MAC ou identifiant).
    const saved = getDevice(d.key);
    if (saved && d.transport === 'wifi' && saved.address !== d.address) void updateDevice(d.key, { address: d.address });
    // Pont Hue déjà autorisé : ses lampes apparaissent directement.
    if (d.family === 'hue-bridge') {
      void knownBridge(d.key)
        .then((auth) => (auth ? hueLightsOf(d, auth.user) : []))
        .then((lights) => {
          if (!lights.length) return;
          putFound(lights);
          for (const l of lights) {
            const saved = getDevice(l.key);
            if (saved && saved.address !== l.address) void updateDevice(l.key, { address: l.address });
          }
        })
        .catch(() => undefined);
    }
  };
  const warn = (w: string): void => set({ warnings: state.warnings.includes(w) ? state.warnings : [...state.warnings, w] });

  if (!(await ensureBlePermissions())) warn(t('Bluetooth non autorisé : seuls les appareils Wi-Fi seront cherchés.'));
  else if (!(await isBluetoothOn())) warn(t('Le Bluetooth est éteint : allume-le pour trouver les rubans Bluetooth.'));
  else scanBle(add, SCAN_MS, (m) => warn(`Bluetooth : ${m}`));

  stopLan?.();
  stopLan = scanLan(add, LAN_LISTEN_MS);
  // Rubans libérés (OpenBeken) et Tasmota : ils ne s'annoncent pas, on frappe à chaque adresse du réseau.
  stopSweep?.();
  stopSweep = sweepSubnet(add);
  setTimeout(() => set({ scanning: false }), SCAN_MS);
}

/** Quitte l'écran d'ajout : on arrête d'écouter le Wi-Fi. */
export function stopScan(): void {
  stopLan?.();
  stopLan = null;
  stopSweep?.();
  stopSweep = null;
}

/**
 * Au démarrage, s'il y a des rubans Wi-Fi enregistrés : une recherche Wi-Fi discrète (pas de Bluetooth, aucune
 * autorisation demandée) pour suivre leurs nouvelles adresses IP. Rien ne s'affiche.
 */
export function refreshWifiAddresses(hasWifi: boolean, hasSilent = false): void {
  if (!hasWifi || state.scanning) return;
  const follow = (d: DetectedDevice): void => {
    const saved = getDevice(d.key);
    if (saved && saved.address !== d.address) void updateDevice(d.key, { address: d.address });
  };
  scanLan(follow, 6000);
  // Seulement s'il y a un ruban qui ne s'annonce pas (OpenBeken) : sinon, inutile de frapper à 254 portes.
  if (hasSilent) sweepSubnet(follow);
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
