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
import { fromLifx, fromMdns, fromYeelight } from '../core/discover';
import { MDNS_ADDRESS, MDNS_PORT, MDNS_SERVICES, mdnsDevices, mdnsQuery, parseMdns } from '../core/mdns';
import {
  LIFX_PORT,
  LIFX_TYPE,
  lifxFrame,
  lifxLabel,
  parseLifx,
  parseYeelight,
  YEELIGHT_DISCOVERY_PORT,
  YEELIGHT_MULTICAST,
  YEELIGHT_PROBE,
} from '../core/protocols/udp';
import { Buffer } from 'buffer';
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
 * Magic Home (sonde UDP 48899), Tuya (écoute 6666/6667), Govee (multicast 4001 → 4002), mDNS (WLED, Hue,
 * Nanoleaf, Elgato, Shelly, ESPHome, Tasmota), Yeelight (multicast 1982), LIFX (broadcast 56700).
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
        report(tuyaFromBroadcast(from.address, decodeBroadcast(bytes)));
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

  // mDNS : questions « réponse en direct » depuis un port quelconque, plus écoute du 5353 (réponses en multicast).
  const onMdns = (bytes: Uint8Array, from: RemoteInfo): void => {
    for (const d of mdnsDevices(parseMdns(bytes), from.address)) report(fromMdns(d));
  };
  sockets.push(openRaw(MDNS_PORT, onMdns));
  const query = Buffer.from(mdnsQuery(Object.keys(MDNS_SERVICES)));
  const mdns = openRaw(0, onMdns);
  sockets.push(mdns);
  for (const delay of [200, 1500, 4000]) {
    timers.push(setTimeout(() => mdns.send(query, undefined, undefined, MDNS_PORT, MDNS_ADDRESS), delay));
  }

  // Yeelight : M-SEARCH sur 1982, réponses en direct ; les lampes s'annoncent aussi d'elles-mêmes.
  const yee = open(0, (text) => {
    const info = parseYeelight(text);
    if (info) report(fromYeelight(info));
  });
  sockets.push(yee);
  for (const delay of [300, 2000]) {
    timers.push(setTimeout(() => yee.send(YEELIGHT_PROBE, undefined, undefined, YEELIGHT_DISCOVERY_PORT, YEELIGHT_MULTICAST), delay));
  }

  // LIFX : GetService en broadcast ; à chaque lampe qui répond, on demande son nom.
  const lifxNames = new Map<string, string>();
  const lifx = openRaw(0, (bytes, from) => {
    const reply = parseLifx([...bytes]);
    if (!reply) return;
    if (reply.type === LIFX_TYPE.StateService) {
      lifx.send(Buffer.from(lifxFrame(LIFX_TYPE.GetLabel, [], reply.mac)), undefined, undefined, LIFX_PORT, from.address);
      // Sans réponse à la demande de nom, on l'ajoute quand même.
      timers.push(setTimeout(() => report(fromLifx(reply, from.address, lifxNames.get(from.address))), 800));
    } else if (reply.type === LIFX_TYPE.StateLabel) {
      lifxNames.set(from.address, lifxLabel(reply.payload));
      seen.delete(fromLifx(reply, from.address).key);
      report(fromLifx(reply, from.address, lifxLabel(reply.payload)));
    }
  });
  sockets.push(lifx);
  timers.push(
    setTimeout(() => {
      try {
        lifx.setBroadcast(true);
      } catch {
        // pas encore liée
      }
      lifx.send(Buffer.from(lifxFrame(LIFX_TYPE.GetService)), undefined, undefined, LIFX_PORT, '255.255.255.255');
    }, 400),
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
