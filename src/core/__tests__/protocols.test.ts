import { describe, expect, it } from 'vitest';
import { hueBleColor, rgbToXy, sp110eColor, sp110ePower, trionesColor, trionesEffect, trionesPower, zenggeHsv, zenggeWrap } from '../protocols/ble';
import { MH_QUERY, mhColor, mhEffect, mhPower, parseMhState } from '../protocols/magicHome';
import { LIFX_TYPE, lifxColor, lifxFrame, lifxLabel, lifxPower, parseLifx, parseYeelight, yeelightColor, yeelightOk, yeelightPower } from '../protocols/udp';
import {
  elgatoColor,
  goveeColor,
  goveePower,
  hueColor,
  parseElgatoInfo,
  parseEsphomeLights,
  parseHueLights,
  parseHuePair,
  parseShellyInfo,
  parseTasmotaStatus,
  parseWledInfo,
  shellyColor,
  tasmotaColor,
  wledColor,
} from '../protocols/wifi';

const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
const RED = { r: 255, g: 0, b: 0 };

describe('Magic Home (TCP 5577)', () => {
  it('trames connues de flux_led', () => {
    expect(hex(mhPower(true))).toBe('71 23 0f a3');
    expect(hex(mhPower(false))).toBe('71 24 0f a4');
    expect(hex(MH_QUERY)).toBe('81 8a 8b 96');
    expect(hex(mhColor(RED))).toBe('31 ff 00 00 00 f0 0f 2f');
    expect(mhColor(RED, true)).toHaveLength(9);
    expect(hex(mhEffect(0x25, 100))).toBe('61 25 01 0f 96');
  });
  it('lit la réponse d’état', () => {
    const body = [0x81, 0x25, 0x23, 0x61, 0x01, 0x10, 0xff, 0x80, 0x00, 0x00, 0x09, 0x00, 0xf0];
    const reply = [...body, body.reduce((a, b) => a + b, 0) & 0xff];
    expect(parseMhState(reply)).toEqual({ model: 0x25, on: true, rgb: { r: 255, g: 128, b: 0 } });
    expect(parseMhState([...body, 0])).toBeNull();
  });
});

describe('Bluetooth : Triones, Zengge, SP110E, Hue', () => {
  it('Triones (HappyLighting)', () => {
    expect(hex(trionesPower(true))).toBe('cc 23 33');
    expect(hex(trionesPower(false))).toBe('cc 24 33');
    expect(hex(trionesColor(RED))).toBe('56 ff 00 00 00 f0 aa');
    expect(hex(trionesEffect(0x25, 100))).toBe('bb 25 01 44');
  });
  it('Zengge : message Magic Home emballé', () => {
    expect(hex(zenggeWrap(mhPower(true), 1))).toBe('00 01 80 00 00 04 05 0b 71 23 0f a3');
    const hsv = zenggeHsv(RED);
    expect(hsv.slice(0, 5)).toEqual([0x3b, 0xa1, 0, 100, 100]);
    expect(hsv[hsv.length - 1]).toBe(hsv.slice(0, -1).reduce((a, b) => a + b, 0) & 0xff);
  });
  it('SP110E', () => {
    expect(hex(sp110ePower(true))).toBe('00 00 00 aa');
    expect(hex(sp110eColor(RED))).toBe('ff 00 00 1e');
  });
  it('Hue : rouge sRGB ≈ (0,64 ; 0,33)', () => {
    const { x, y } = rgbToXy(RED);
    expect(x).toBeCloseTo(0.64, 2);
    expect(y).toBeCloseTo(0.33, 2);
    expect(hueBleColor(RED)).toHaveLength(4);
  });
});

describe('Wi-Fi HTTP / UDP', () => {
  it('WLED', () => {
    expect(wledColor(RED)).toEqual({ method: 'POST', path: '/json/state', body: { on: true, seg: [{ col: [[255, 0, 0]], fx: 0 }] } });
    expect(parseWledInfo({ name: 'Bureau', ver: '0.15.0', brand: 'WLED', leds: { count: 60 } })).toEqual({ name: 'Bureau', leds: 60, version: '0.15.0' });
    expect(parseWledInfo({ hello: 1 })).toBeNull();
  });
  it('Govee LAN (doc officielle)', () => {
    expect(JSON.parse(goveePower(true))).toEqual({ msg: { cmd: 'turn', data: { value: 1 } } });
    expect(JSON.parse(goveeColor(RED))).toEqual({ msg: { cmd: 'colorwc', data: { color: { r: 255, g: 0, b: 0 }, colorTemInKelvin: 0 } } });
  });
  it('Shelly', () => {
    expect(shellyColor('gen1', RED).path).toBe('/color/0?turn=on&red=255&green=0&blue=0&white=0');
    expect(shellyColor('rgbw', RED).path).toBe('/rpc/RGBW.Set?id=0&on=true&rgb=%5B255%2C0%2C0%5D');
    expect(parseShellyInfo({ type: 'SHRGBW2', mac: 'A' })).toEqual({ kind: 'gen1', model: 'SHRGBW2' });
    expect(parseShellyInfo({ gen: 2, app: 'PlusRGBWPM' })).toEqual({ kind: 'rgbw', model: 'PlusRGBWPM' });
    expect(parseShellyInfo({ type: 'SHSW-1' })).toBeNull();
  });
  it('Tasmota', () => {
    expect(tasmotaColor(RED).path).toBe('/cm?cmnd=Color%20FF0000');
    expect(parseTasmotaStatus({ Status: { DeviceName: 'Ruban' }, StatusSTS: { Dimmer: 50, Color: 'FF0000' } })).toEqual({ name: 'Ruban', color: true, ct: false });
    expect(parseTasmotaStatus({ Status: { DeviceName: 'Prise' }, StatusSTS: { POWER: 'ON' } })).toBeNull();
  });
  it('Hue (pont)', () => {
    expect(parseHuePair([{ error: { type: 101, description: 'link button not pressed' } }])).toEqual({ needButton: true });
    expect(parseHuePair([{ success: { username: 'abc' } }])).toEqual({ user: 'abc' });
    expect(hueColor('u', '3', RED).body).toEqual({ on: true, hue: 0, sat: 254 });
    const lights = parseHueLights({
      '1': { name: 'Télé', type: 'Extended color light', productname: 'Hue lightstrip plus' },
      '2': { name: 'Prise', type: 'On/Off plug-in unit' },
      '3': { name: 'Bureau', type: 'Color temperature light', productname: 'Hue white ambiance' },
    });
    expect(lights).toEqual([
      { id: '1', name: 'Télé', product: 'Hue lightstrip plus', color: true, ct: true },
      // Blancs seulement : pas de couleur, mais chaud / froid.
      { id: '3', name: 'Bureau', product: 'Hue white ambiance', color: false, ct: true },
    ]);
  });
  it('Elgato, ESPHome', () => {
    expect(parseElgatoInfo({ productName: 'Elgato Light Strip', displayName: '' })).toEqual({ name: 'Elgato Light Strip', color: true });
    expect(elgatoColor(RED).body).toEqual({ numberOfLights: 1, lights: [{ on: 1, hue: 0, saturation: 100 }] });
    expect(parseEsphomeLights('event: state\ndata: {"id":"light-ruban_salon","state":"ON"}\n\ndata: {"id":"sensor-x"}')).toEqual(['ruban_salon']);
  });
  it('Yeelight (exemple de la spécification)', () => {
    const reply =
      'HTTP/1.1 200 OK\r\nCache-Control: max-age=3600\r\nLocation: yeelight://192.168.1.239:55443\r\nServer: POSIX UPnP/1.0 YGLC/1\r\n' +
      'id: 0x000000000015243f\r\nmodel: color\r\nfw_ver: 18\r\nsupport: get_prop set_default set_power toggle set_bright start_cf stop_cf set_scene cron_add cron_get cron_del set_ct_abx set_rgb\r\n' +
      'power: on\r\nbright: 100\r\ncolor_mode: 2\r\nct: 4000\r\nrgb: 16711680\r\nhue: 100\r\nsat: 35\r\nname: my_bulb\r\n';
    expect(parseYeelight(reply)).toEqual({ id: '0x000000000015243f', ip: '192.168.1.239', port: 55443, model: 'color', name: 'my_bulb', color: true });
    expect(yeelightPower(true)).toMatch(/"method":"set_power","params":\["on","smooth",300\]\}\r\n$/);
    expect(yeelightColor(RED)).toContain('"params":[16711680,"smooth",300]');
    expect(yeelightOk('{"id":1, "result":["ok"]}\r\n')).toBe(true);
  });
  it('LIFX : en-tête de découverte comme dans la doc (24 00 00 34)', () => {
    const f = lifxFrame(LIFX_TYPE.GetService);
    expect(hex(f.slice(0, 4))).toBe('24 00 00 34');
    expect(f[32]).toBe(2);
    const mac = [0xd0, 0x73, 0xd5, 0x01, 0x02, 0x03];
    const p = lifxPower(mac, true);
    expect(hex(p.slice(2, 4))).toBe('00 14');
    expect(p.slice(8, 14)).toEqual(mac);
    expect(p.slice(36, 38)).toEqual([0xff, 0xff]);
    expect(lifxColor(mac, RED)).toHaveLength(36 + 13);
    const label = [...'Bureau'].map((c) => c.charCodeAt(0));
    const reply = lifxFrame(LIFX_TYPE.StateLabel, [...label, ...new Array(32 - label.length).fill(0)], mac);
    const parsed = parseLifx(reply)!;
    expect(parsed.type).toBe(25);
    expect(lifxLabel(parsed.payload)).toBe('Bureau');
  });
});
