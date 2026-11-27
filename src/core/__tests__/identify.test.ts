import { describe, expect, it } from 'vitest';
import { elkColor, elkEffect, elkEffects, elkInit, elkPower, elkSpeed } from '../elk';
import { identifyBle, parseGoveeReply, parseMagicHomeReply, tuyaFromBroadcast } from '../identify';

const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('');

describe('identification Bluetooth', () => {
  it('reconnaît les deux bandeaux de Guillaume', () => {
    const melk = identifyBle({ id: 'BE:16:92:00:CA:92', name: 'MELK-OA21   92', rssi: -87 });
    expect(melk).toMatchObject({ family: 'elk-bledom', confidence: 'sure', model: 'melk', rawName: 'MELK-OA21   92' });
    const elk = identifyBle({ id: 'BE:60:B0:00:5F:37', name: 'ELK-BLEDOB' });
    expect(elk).toMatchObject({ family: 'elk-bledom', model: 'bledob', key: 'ble:BE:60:B0:00:5F:37' });
  });

  it.each([
    ['Triones-FFFF0012AB', 'triones'],
    ['QHM-1A2B', 'triones'],
    ['LEDnetWF02001D0C', 'zengge-ble'],
    ['SP110E', 'sp110e'],
    ['BJ_LED_M', 'mohuan'],
    ['ihoment_H6159_1A2B', 'govee'],
  ])('%s → %s', (name, family) => {
    expect(identifyBle({ id: 'x', name })?.family).toBe(family);
  });

  it('ignore ce qui n’est pas un contrôleur LED', () => {
    expect(identifyBle({ id: 'x', name: 'MX Master' })).toBeNull();
    expect(identifyBle({ id: 'x', name: 'Bouygtel4K' })).toBeNull();
    expect(identifyBle({ id: 'x', name: null })).toBeNull();
  });
});

describe('identification Wi-Fi', () => {
  it('lit une réponse Magic Home', () => {
    expect(parseMagicHomeReply('192.168.1.20,ACCF23A1B2C3,AK001-ZJ2101', '192.168.1.20')).toMatchObject({
      family: 'magichome-wifi',
      key: 'wifi:ACCF23A1B2C3',
      address: '192.168.1.20',
      model: 'AK001-ZJ2101',
    });
    expect(parseMagicHomeReply('HF-A11ASSISTHREAD', '192.168.1.44')).toBeNull();
    expect(parseMagicHomeReply('n’importe quoi', '192.168.1.3')).toBeNull();
  });

  it('lit une réponse Govee', () => {
    const text = JSON.stringify({ msg: { cmd: 'scan', data: { ip: '192.168.1.30', device: '1F:80:C5:32', sku: 'H6159' } } });
    expect(parseGoveeReply(text, '192.168.1.30')).toMatchObject({ family: 'govee-lan', rawName: 'Govee H6159' });
    expect(parseGoveeReply('{', '1.2.3.4')).toBeNull();
  });

  it('range un paquet Tuya illisible sous son IP, et un lisible sous son identifiant', () => {
    expect(tuyaFromBroadcast('192.168.1.40')).toMatchObject({ family: 'tuya', key: 'wifi:192.168.1.40' });
    expect(tuyaFromBroadcast('192.168.1.40', { gwId: 'bf78', ip: '192.168.1.78', version: '3.4' })).toMatchObject({
      key: 'tuya:bf78',
      address: '192.168.1.78',
      model: '3.4',
      tuyaId: 'bf78',
    });
  });
});

describe('protocole ELK', () => {
  it('reprend les trames validées sur le MELK-OA21', () => {
    // La seconde trame éteint le ruban : on le rallume aussitôt.
    expect(elkInit('melk').map(hex)).toEqual(['7e0783', '7e0404', '7e0404f00001ff00ef']);
    expect(hex(elkPower('melk', true))).toBe('7e0404f00001ff00ef');
    expect(hex(elkPower('melk', false))).toBe('7e0404000000ff00ef');
    expect(hex(elkPower('elk', true))).toBe('7e0004f00001ff00ef');
    expect(hex(elkPower('bledob', true))).toBe('7e0704ff00010201ef');
  });

  it('encode effets et vitesse selon la variante', () => {
    expect(hex(elkEffect('melk', 61))).toBe('7e05033d06ffff00ef');
    expect(hex(elkEffect('elk', 0x88))).toBe('7e00038803000000ef');
    expect(hex(elkSpeed('melk', 150))).toBe('7e040264ffffff00ef');
    expect(elkEffects('melk').length).toBeGreaterThan(4);
  });

  it('borne les couleurs', () => {
    expect(hex(elkColor('elk', { r: 300, g: -4, b: 127.6 }))).toBe('7e000503ff008000ef');
  });
});
