/**
 * Appareils Wi-Fi trouvés par mDNS, par la découverte Yeelight ou LIFX → `DetectedDevice`.
 * Pur TypeScript (les sockets sont dans `services/lan.ts`).
 */
import type { DetectedDevice } from './identify';
import type { MdnsDevice } from './mdns';
import { lifxLabel, macHex, type LifxReply, type YeelightInfo } from './protocols/udp';

const wifi = (key: string, family: DetectedDevice['family'], rawName: string, address: string, extra: Partial<DetectedDevice> = {}): DetectedDevice => ({
  key,
  family,
  confidence: 'sure',
  transport: 'wifi',
  rawName,
  address,
  ...extra,
});

/** Un service mDNS → un appareil, ou null si ce n'est pas une lumière qu'on sait piloter ou reconnaître. */
export function fromMdns(d: MdnsDevice): DetectedDevice | null {
  if (!d.ip) return null;
  const name = d.txt.fn || d.txt.friendly_name || d.txt.name || d.instance;
  switch (d.service) {
    case '_wled._tcp.local':
      return wifi(`wifi:wled:${(d.txt.mac || d.ip).toUpperCase()}`, 'wled', d.instance, d.ip);
    case '_hue._tcp.local': {
      const id = (d.txt.bridgeid || d.ip).toUpperCase();
      return wifi(`hue-bridge:${id}`, 'hue-bridge', 'Philips Hue', d.ip, { model: d.txt.modelid, meta: { bridge: id } });
    }
    case '_nanoleafapi._tcp.local':
      return wifi(`wifi:nanoleaf:${(d.txt.id || d.ip).toUpperCase()}`, 'nanoleaf', name, d.ip, { model: d.txt.md, meta: { port: String(d.port ?? 16021) } });
    case '_elg._tcp.local': {
      const color = /strip/i.test(d.txt.md ?? '') ? '1' : '0';
      return wifi(`wifi:elgato:${(d.txt.id || d.ip).toUpperCase()}`, 'elgato', name, d.ip, { model: d.txt.md, meta: { color } });
    }
    case '_shelly._tcp.local':
      if (!/RGBW/i.test(d.txt.app ?? '')) return null;
      return wifi(`wifi:shelly:${d.instance.toUpperCase()}`, 'shelly', d.instance, d.ip, { model: d.txt.app, meta: { shelly: 'rgbw' } });
    case '_http._tcp.local':
      // Shelly 1re génération (nom d'hôte shellyrgbw2-XXXX…) et Tasmota (tasmota-XXXX) annoncent un simple service web.
      if (/^shelly(rgbw2|colorbulb|bulbduo|bulb)-/i.test(d.instance)) {
        const model = /^shellyrgbw2/i.test(d.instance) ? 'SHRGBW2' : 'SHCB-1';
        return wifi(`wifi:shelly:${d.instance.toUpperCase()}`, 'shelly', d.instance, d.ip, { model, meta: { shelly: 'gen1' } });
      }
      if (/^tasmota[-_]/i.test(d.instance)) return wifi(`wifi:tasmota:${d.instance.toUpperCase()}`, 'tasmota', d.instance, d.ip, { confidence: 'probable' });
      return null;
    case '_esphomelib._tcp.local':
      return wifi(`wifi:esphome:${d.instance.toUpperCase()}`, 'esphome', name, d.ip, { confidence: 'probable' });
  }
  return null;
}

export const fromYeelight = (y: YeelightInfo): DetectedDevice =>
  wifi(`wifi:yeelight:${y.id}`, 'yeelight', y.name || y.model, y.ip, { model: y.model, meta: { port: String(y.port), color: y.color ? '1' : '0' } });

export function fromLifx(reply: LifxReply, ip: string, label?: string): DetectedDevice {
  const mac = macHex(reply.mac);
  return wifi(`wifi:lifx:${mac}`, 'lifx', label || (reply.type === 25 ? lifxLabel(reply.payload) : 'LIFX'), ip, { meta: { mac } });
}
