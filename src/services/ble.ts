import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';

import { ELK_SERVICE, ELK_WRITE_CHAR, elkInit, type ElkModel } from '../core/elk';
import { identifyBle, type DetectedDevice } from '../core/identify';
import type { BleProfile } from '../core/protocols/types';
import { t } from '../i18n';

let manager: BleManager | null = null;
const getManager = (): BleManager => (manager ??= new BleManager());

/** Demande les autorisations Bluetooth (Android 12+ : scan et connexion, sans localisation). */
export async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(res).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export async function isBluetoothOn(): Promise<boolean> {
  return (await getManager().state()) === State.PoweredOn;
}

/**
 * Scanne le Bluetooth pendant `durationMs` et signale chaque contrôleur LED reconnu.
 * Renvoie une fonction d'arrêt anticipé.
 */
export function scanBle(onDevice: (device: DetectedDevice) => void, durationMs: number, onError: (message: string) => void): () => void {
  const ble = getManager();
  const seen = new Set<string>();
  ble
    .startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        onError(error.message);
        return;
      }
      if (!device) return;
      const found = identifyBle({ id: device.id, name: device.localName ?? device.name, rssi: device.rssi, serviceUUIDs: device.serviceUUIDs });
      if (found && !seen.has(found.key)) {
        seen.add(found.key);
        onDevice(found);
      }
    })
    .catch((e: Error) => onError(e.message));
  const timer = setTimeout(() => void ble.stopDeviceScan(), durationMs);
  return () => {
    clearTimeout(timer);
    void ble.stopDeviceScan();
  };
}

// ── Envoi de trames (toutes familles) ────────────────────────────────────────────

/** Connexions ouvertes, gardées un moment pour enchaîner les réglages sans se reconnecter. */
type Session = { ready: Promise<void>; idle?: ReturnType<typeof setTimeout>; off?: { remove: () => void } };
const sessions = new Map<string, Session>();
/** Ferme une session : seulement si c'est toujours elle (une ancienne déconnexion ne doit pas effacer la nouvelle). */
function endSession(address: string, session: Session): void {
  if (session.idle) clearTimeout(session.idle);
  session.off?.remove();
  if (sessions.get(address) === session) sessions.delete(address);
}
const IDLE_MS = 20_000;

function scheduleDisconnect(address: string): void {
  const session = sessions.get(address);
  if (!session) return;
  if (session.idle) clearTimeout(session.idle);
  session.idle = setTimeout(() => {
    endSession(address, session);
    void getManager().cancelDeviceConnection(address).catch(() => undefined);
  }, IDLE_MS);
}

async function writeRaw(address: string, profile: BleProfile, bytes: number[]): Promise<void> {
  const data = Buffer.from(bytes).toString('base64');
  const ble = getManager();
  if (profile.withResponse) await ble.writeCharacteristicWithResponseForDevice(address, profile.service, profile.write, data);
  else await ble.writeCharacteristicWithoutResponseForDevice(address, profile.service, profile.write, data);
}

async function connect(address: string, profile: BleProfile, session: Session): Promise<void> {
  const ble = getManager();
  await ble.connectToDevice(address, { timeout: 10_000 });
  await ble.discoverAllServicesAndCharacteristicsForDevice(address);
  for (const frame of profile.init ?? []) await writeRaw(address, profile, frame);
  // Un seul écouteur par connexion, retiré avec elle (avant : un de plus à chaque reconnexion).
  session.off = ble.onDeviceDisconnected(address, () => endSession(address, session));
}

/**
 * Envoie des trames à un contrôleur Bluetooth, en se connectant si besoin.
 * Ces contrôleurs n'acceptent qu'une connexion : si l'appli d'origine est ouverte, ça échoue.
 */
export async function sendBle(address: string, profile: BleProfile, ...frames: number[][]): Promise<void> {
  let session = sessions.get(address);
  // Un envoi commence : la déconnexion pour inactivité ne doit pas tomber au milieu.
  if (session?.idle) clearTimeout(session.idle);
  if (!session) {
    const fresh: Session = { ready: Promise.resolve() };
    fresh.ready = connect(address, profile, fresh);
    sessions.set(address, fresh);
    session = fresh;
  }
  try {
    await session.ready;
    for (const f of frames) await writeRaw(address, profile, f);
  } catch {
    // Les messages de la pile Bluetooth sont techniques et en anglais : on dit simplement quoi faire.
    endSession(address, session);
    void getManager().cancelDeviceConnection(address).catch(() => undefined);
    throw new Error(t('Rapproche-toi du ruban et ferme ses autres applis.'));
  }
  scheduleDisconnect(address);
}

/** Profil d'un contrôleur ELK-BLEDOM (service FFF0, trames d'ouverture selon la variante). */
const elkProfile = (model: ElkModel): BleProfile => ({ service: ELK_SERVICE, write: ELK_WRITE_CHAR, init: elkInit(model) });

export const sendElk = (address: string, model: ElkModel, bytes: number[]): Promise<void> => sendBle(address, elkProfile(model), bytes);
