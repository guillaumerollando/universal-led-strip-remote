import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';

import { ELK_SERVICE, ELK_WRITE_CHAR, elkInit, type ElkModel } from '../core/elk';
import { identifyBle, type DetectedDevice } from '../core/identify';

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
      const found = identifyBle({ id: device.id, name: device.localName ?? device.name, rssi: device.rssi });
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

// ── Contrôle ELK-BLEDOM ──────────────────────────────────────────────────

/** Connexions ouvertes, gardées un moment pour enchaîner les réglages sans se reconnecter. */
const sessions = new Map<string, { ready: Promise<void>; idle?: ReturnType<typeof setTimeout> }>();
const IDLE_MS = 20_000;

function scheduleDisconnect(address: string): void {
  const session = sessions.get(address);
  if (!session) return;
  if (session.idle) clearTimeout(session.idle);
  session.idle = setTimeout(() => {
    sessions.delete(address);
    void getManager().cancelDeviceConnection(address).catch(() => undefined);
  }, IDLE_MS);
}

async function writeRaw(address: string, bytes: number[]): Promise<void> {
  await getManager().writeCharacteristicWithoutResponseForDevice(
    address,
    ELK_SERVICE,
    ELK_WRITE_CHAR,
    Buffer.from(bytes).toString('base64'),
  );
}

async function connect(address: string, model: ElkModel): Promise<void> {
  const ble = getManager();
  await ble.connectToDevice(address, { timeout: 10_000 });
  await ble.discoverAllServicesAndCharacteristicsForDevice(address);
  for (const frame of elkInit(model)) await writeRaw(address, frame);
  ble.onDeviceDisconnected(address, () => sessions.delete(address));
}

/**
 * Envoie une trame à un contrôleur ELK, en se connectant si besoin.
 * Ces contrôleurs n'acceptent qu'une connexion : si l'appli d'origine est ouverte, ça échoue.
 */
export async function sendElk(address: string, model: ElkModel, bytes: number[]): Promise<void> {
  let session = sessions.get(address);
  if (!session) {
    session = { ready: connect(address, model) };
    sessions.set(address, session);
  }
  try {
    await session.ready;
  } catch (e) {
    sessions.delete(address);
    throw e;
  }
  await writeRaw(address, bytes);
  scheduleDisconnect(address);
}
