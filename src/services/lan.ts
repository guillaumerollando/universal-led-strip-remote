import * as Network from 'expo-network';
import dgram from 'react-native-udp';

import {
  GOVEE_MULTICAST,
  GOVEE_PROBE,
  GOVEE_REPLY_PORT,
  GOVEE_SCAN_PORT,
  MAGIC_HOME_PORT,
  MAGIC_HOME_PROBE,
  parseGoveeReply,
  parseMagicHomeReply,
  tuyaFromBroadcast,
  TUYA_PORTS,
  type DetectedDevice,
} from '../core/identify';
import { decodeBroadcast } from '../core/tuya/local';
import native from '../../modules/rubanix-native/src';

type UdpSocket = ReturnType<typeof dgram.createSocket>;
interface RemoteInfo {
  address: string;
  port: number;
}

/** Adresse de broadcast du sous-réseau (on suppose un /24, le cas de toutes les box). */
async function subnetBroadcast(): Promise<string | null> {
  const ip = await Network.getIpAddressAsync().catch(() => null);
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip) || ip === '0.0.0.0') return null;
  return ip.replace(/\.\d+$/, '.255');
}

/** Dernière IP vue pour chaque appareil Tuya (son IP peut changer : la box la redistribue). */
const tuyaIps = new Map<string, string>();
const rememberTuyaIp = (id: string, ip: string): void => void tuyaIps.set(id, ip);
export const lastTuyaIp = (id: string): string | undefined => tuyaIps.get(id);

function openRaw(port: number, onMessage: (bytes: Uint8Array, from: RemoteInfo) => void): UdpSocket {
  const socket = dgram.createSocket({ type: 'udp4', reusePort: true });
  socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => onMessage(new Uint8Array(msg), rinfo));
  socket.on('error', () => undefined);
  socket.bind(port);
  return socket;
}

function open(port: number, onMessage: (text: string, from: RemoteInfo) => void, onReady?: (s: UdpSocket) => void): UdpSocket {
  const socket = dgram.createSocket({ type: 'udp4', reusePort: true });
  socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => onMessage(msg.toString('utf8'), rinfo));
  // Un port déjà pris (autre appli) ne doit pas faire échouer le reste du scan.
  socket.on('error', () => undefined);
  socket.bind(port, () => onReady?.(socket));
  return socket;
}

/**
 * Cherche les contrôleurs Wi-Fi du réseau local pendant `durationMs` :
 * Magic Home (sonde UDP 48899), Tuya (écoute 6666/6667), Govee (multicast 4001 → 4002).
 * Renvoie une fonction d'arrêt anticipé.
 */
export function scanLan(onDevice: (device: DetectedDevice) => void, durationMs: number): () => void {
  const seen = new Set<string>();
  const report = (d: DetectedDevice | null): void => {
    if (d && !seen.has(d.key)) {
      seen.add(d.key);
      onDevice(d);
    }
  };
  native?.acquireMulticastLock();

  const sockets: UdpSocket[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];

  sockets.push(
    open(0, (text, from) => report(parseMagicHomeReply(text, from.address)), (s) => {
      s.setBroadcast(true);
      void subnetBroadcast().then((subnet) => {
        const targets = ['255.255.255.255', ...(subnet ? [subnet] : [])];
        // Trois envois espacés : l'UDP se perd facilement en Wi-Fi.
        for (const delay of [0, 1000, 2500]) {
          timers.push(
            setTimeout(() => {
              for (const t of targets) s.send(MAGIC_HOME_PROBE, undefined, undefined, MAGIC_HOME_PORT, t);
            }, delay),
          );
        }
      });
    }),
  );

  for (const port of TUYA_PORTS) {
    sockets.push(
      openRaw(port, (bytes, from) => {
        const info = decodeBroadcast(bytes);
        if (info) rememberTuyaIp(info.gwId, info.ip);
        report(tuyaFromBroadcast(from.address, info));
      }),
    );
  }

  sockets.push(
    open(GOVEE_REPLY_PORT, (text, from) => report(parseGoveeReply(text, from.address)), () => {
      const sender = dgram.createSocket({ type: 'udp4' });
      sockets.push(sender);
      sender.on('error', () => undefined);
      sender.bind(0, () => sender.send(GOVEE_PROBE, undefined, undefined, GOVEE_SCAN_PORT, GOVEE_MULTICAST));
    }),
  );

  const stop = (): void => {
    timers.forEach(clearTimeout);
    for (const s of sockets) {
      try {
        s.close();
      } catch {
        // déjà fermée
      }
    }
    sockets.length = 0;
    native?.releaseMulticastLock();
  };
  timers.push(setTimeout(stop, durationMs));
  return stop;
}
