import { ecb } from '@noble/ciphers/aes.js';
import { describe, expect, it } from 'vitest';

import { ascii, concat, fromHex, hex, utf8 } from '../bytes';
import { decodeBroadcast, frameLength, pack55AA, pack6699, UDP_KEY, unpackFrame } from '../local';

/** Trames de référence produites par tinytuya 1.20.0 avec les mêmes entrées. */
const REF = {
  f33: '000055aa000000010000000700000067332e33000000000000000000000000f36f3bf3e082b0e0638499f4fd3402c5012eea3a0f92a31c78edff31ddfdb02514289c9042f2aa08005786aab66fcc6dd2aabe6f348ff0b442995f5c9f24d0ec377222e061a924c591cd9c27ea163ed45fe134bc0000aa55',
  f35: '000066990000000000030000000d000000636465666768696a6b6c6d6e6f294c7ba5db02b8fa9b3e571086ca2b9712f80a90e6c6be35984d8ba290d083d180cd6514bb2817a1ba68176aafe62573babf2708bf62315be1b47a7ffeae475a10e86768d1caeff89ed0a7d407bde9c45c988688ba90e900009966',
};
const KEY = ascii('0123456789abcdef');
const SK = Uint8Array.from({ length: 16 }, (_, i) => i);
const IV = Uint8Array.from({ length: 12 }, (_, i) => 100 + i);
const Z = new Uint8Array(12);

describe('trames Tuya identiques à tinytuya', () => {
  it('55AA (3.3) avec CRC32', () => {
    const body = utf8('{"devId":"dev1","uid":"dev1","t":"1700000000","dps":{"20":true}}');
    expect(hex(pack55AA(1, 7, concat(ascii('3.3'), Z, ecb(KEY).encrypt(body))))).toBe(REF.f33);
  });

  it('6699 (3.5) en AES-GCM, et relecture', () => {
    const body = utf8('{"protocol":5,"t":1700000000,"data":{"dps":{"20":true}}}');
    const frame = pack6699(3, 13, concat(ascii('3.5'), Z, body), SK, IV);
    expect(hex(frame)).toBe(REF.f35);
    expect(frameLength(fromHex(REF.f35))).toBe(frame.length);
    expect(unpackFrame(frame, SK, { hasRetcode: false }).cmd).toBe(13);
  });
});

describe('annonces UDP', () => {
  it('déchiffre une annonce 3.3 sur 6667', () => {
    const json = utf8('{"ip":"192.168.1.78","gwId":"bf123","active":2,"encrypt":true,"productKey":"abc","version":"3.3"}');
    const enc = ecb(UDP_KEY).encrypt(json);
    const payload = new Uint8Array(4 + enc.length);
    payload.set(enc, 4);
    expect(decodeBroadcast(pack55AA(0, 0x13, payload))).toMatchObject({ ip: '192.168.1.78', gwId: 'bf123', version: '3.3' });
  });

  it('ignore ce qui n’est pas une annonce', () => {
    expect(decodeBroadcast(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });
});
