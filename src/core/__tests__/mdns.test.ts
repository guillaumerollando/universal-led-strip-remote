import { describe, expect, it } from 'vitest';
import { productName, stripKind } from '../describe';
import { fromLifx, fromMdns, fromYeelight } from '../discover';
import { identifyBle } from '../identify';
import { mdnsAnswerForTest, mdnsDevices, mdnsQuery, parseMdns } from '../mdns';
import { lifxFrame } from '../protocols/udp';

describe('mDNS', () => {
  it('question PTR avec le bit « réponse en direct »', () => {
    const q = mdnsQuery(['_wled._tcp.local']);
    expect(q.slice(4, 6)).toEqual([0, 1]);
    expect(q.slice(-4)).toEqual([0, 12, 0x80, 1]);
    expect(q.slice(12, 18)).toEqual([5, ...'_wled'.split('').map((c) => c.charCodeAt(0))]);
  });

  it('lit une réponse WLED et en fait un appareil', () => {
    const packet = mdnsAnswerForTest('_wled._tcp.local', 'WLED-Bureau', '192.168.1.42', 80, ['mac=a8032a1b2c3d']);
    const devices = mdnsDevices(parseMdns(packet));
    expect(devices).toEqual([{ service: '_wled._tcp.local', instance: 'WLED-Bureau', ip: '192.168.1.42', port: 80, txt: { mac: 'a8032a1b2c3d' } }]);
    expect(fromMdns(devices[0])).toMatchObject({ key: 'wifi:wled:A8032A1B2C3D', family: 'wled', address: '192.168.1.42', rawName: 'WLED-Bureau' });
  });

  it('pont Hue, Nanoleaf, Elgato, Shelly', () => {
    const dev = (service: string, instance: string, txt: string[]) =>
      fromMdns(mdnsDevices(parseMdns(mdnsAnswerForTest(service, instance, '10.0.0.5', 443, txt)))[0]);
    expect(dev('_hue._tcp.local', 'Hue Bridge - 1A2B3C', ['bridgeid=001788fffe1a2b3c', 'modelid=BSB002'])).toMatchObject({
      family: 'hue-bridge',
      key: 'hue-bridge:001788FFFE1A2B3C',
    });
    expect(dev('_nanoleafapi._tcp.local', 'Shapes 4A1B', ['md=NL42', 'id=4A:1B'])).toMatchObject({ family: 'nanoleaf', model: 'NL42' });
    expect(dev('_elg._tcp.local', 'Elgato Light Strip 1A2B', ['md=Elgato Light Strip', 'id=3C:6A'])).toMatchObject({ family: 'elgato', meta: { color: '1' } });
    expect(dev('_shelly._tcp.local', 'ShellyPlusRGBWPM-AABB', ['gen=2', 'app=PlusRGBWPM'])).toMatchObject({ family: 'shelly', meta: { shelly: 'rgbw' } });
    expect(dev('_shelly._tcp.local', 'ShellyPlus1-AABB', ['gen=2', 'app=Plus1'])).toBeNull();
    expect(dev('_http._tcp.local', 'shellyrgbw2-C0FFEE', [])).toMatchObject({ family: 'shelly', meta: { shelly: 'gen1' } });
  });
});

describe('nom compréhensible des appareils', () => {
  it('marque et modèle quand on les connaît', () => {
    expect(productName({ family: 'govee', rawName: 'ihoment_H6159_1A2B' })).toBe('Govee H6159');
    expect(productName({ family: 'nanoleaf', rawName: 'Shapes', model: 'NL42' })).toBe('Nanoleaf Shapes');
    expect(productName({ family: 'hue', rawName: 'Télé', meta: { product: 'Hue lightstrip plus' } })).toBe('Philips Hue lightstrip plus');
    expect(productName(fromYeelight({ id: '0x1', ip: '1.2.3.4', port: 55443, model: 'stripe', name: '', color: true }))).toBe('Yeelight Lightstrip');
  });
  it('jamais de nom de puce pour un contrôleur sans marque', () => {
    expect(productName({ family: 'elk-bledom', rawName: 'ELK-BLEDOM' })).toBeUndefined();
    expect(stripKind({ family: 'sp110e', rawName: 'SP110E' })).toBe('Ruban à pixels');
  });
  it('LIFX et Hue en Bluetooth', () => {
    const mac = [0xd0, 0x73, 0xd5, 1, 2, 3];
    expect(fromLifx({ type: 3, mac, payload: [] }, '10.0.0.9', 'Bureau')).toMatchObject({ key: 'wifi:lifx:D073D5010203', meta: { mac: 'D073D5010203' } });
    expect(lifxFrame(2)).toHaveLength(36);
    expect(identifyBle({ id: 'AA', name: 'Hue color lamp', serviceUUIDs: ['0000fe0f-0000-1000-8000-00805f9b34fb'] })?.family).toBe('hue-ble');
  });
});

describe('ajout par adresse IP', async () => {
  const { classifyProbe, isIpv4 } = await import('../probe');
  it('reconnaît l’appareil d’après la réponse de son API', () => {
    expect(isIpv4('192.168.1.42')).toBe(true);
    expect(isIpv4('192.168.1.')).toBe(false);
    expect(isIpv4('300.1.1.1')).toBe(false);
    expect(classifyProbe('10.0.0.2', { wled: { name: 'Bureau', brand: 'WLED', leds: { count: 30 } } })).toMatchObject({ family: 'wled', rawName: 'Bureau' });
    expect(classifyProbe('10.0.0.3', { tasmota: { Status: { DeviceName: 'Ruban' }, StatusSTS: { Dimmer: 10, Color: '00FF00' } } })).toMatchObject({ family: 'tasmota' });
    expect(classifyProbe('10.0.0.4', { wled: '<html>' })).toBeNull();
  });
});
