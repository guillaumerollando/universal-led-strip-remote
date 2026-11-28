import { describe, expect, it } from 'vitest';

import { homeNetworks, parseWifiQr, setupApOf, setupSteps, waitingLights, type WifiNetwork } from '../setupAp';

const net = (ssid: string, frequency = 2437, level = -50, secure = false): WifiNetwork => ({ ssid, frequency, level, secure });

describe('Lumières qui attendent d’être configurées', () => {
  it('reconnaît les réseaux créés par les lumières', () => {
    expect(setupApOf('OpenBK7231T_1A2B3C4D')).toMatchObject({ family: 'openbeken', method: 'openbeken' });
    expect(setupApOf('tasmota-5F3A2C-6700')).toMatchObject({ family: 'tasmota' });
    expect(setupApOf('WLED-AP')).toMatchObject({ family: 'wled', apPassword: 'wled1234' });
    expect(setupApOf('Bureau Fallback Hotspot')).toMatchObject({ family: 'esphome' });
    expect(setupApOf('shellyrgbw2-A4CF12B3C4D5')).toMatchObject({ method: 'shelly1' });
    expect(setupApOf('ShellyPlusRGBWPM-ECC9FF123456')).toMatchObject({ method: 'shelly2' });
    expect(setupApOf('LEDnet00A3B2C1')).toMatchObject({ family: 'magichome-wifi' });
    expect(setupApOf('SmartLife-1A2B')).toMatchObject({ family: 'tuya', method: 'closed' });
  });

  it('laisse tranquilles les box et les autres réseaux', () => {
    for (const ssid of ['SFR_B8E8', 'Livebox-1234', 'Freebox-ABC', 'iPhone de Paul', 'shellfish', 'MyShellyHouse']) expect(setupApOf(ssid)).toBeUndefined();
  });

  it('une seule ligne par lumière, la plus proche d’abord', () => {
    const list = waitingLights([net('Livebox-1'), net('OpenBK_1', 2437, -70), net('OpenBK_1', 2437, -40), net('WLED-AP', 2412, -60)]);
    expect(list.map((l) => [l.ssid, l.level])).toEqual([
      ['OpenBK_1', -40],
      ['WLED-AP', -60],
    ]);
  });

  it('propose le Wi-Fi de la maison : le réseau actuel, puis le 2,4 GHz', () => {
    const list = homeNetworks([net('Voisin', 2412, -80), net('Box', 5180, -40), net('Box', 2437, -55), net('OpenBK_1'), net('Maison', 2462, -60)], 'Maison');
    expect(list.map((n) => [n.ssid, n.frequency])).toEqual([
      ['Maison', 2462],
      ['Box', 2437],
      ['Voisin', 2412],
    ]);
  });
});

describe('Téléphone sur le 5 GHz de la box', () => {
  it('propose d’abord le 2,4 GHz de la même box', () => {
    const list = homeNetworks([net('SFR_B8E8_5GHZ', 5180, -40), net('SFR_B8E8', 2437, -55), net('Voisin', 2412, -70)], 'SFR_B8E8_5GHZ');
    expect(list.map((n) => n.ssid)).toEqual(['SFR_B8E8', 'SFR_B8E8_5GHZ', 'Voisin']);
  });
});

describe('Ce qu’on envoie à la lumière', () => {
  it('OpenBeken : le formulaire du ruban, mot de passe encodé', () => {
    expect(setupSteps('openbeken', 'Ma Box', 'p&ss=1')).toEqual([{ kind: 'http', method: 'GET', url: 'http://192.168.4.1/cfg_wifi_set?ssid=Ma%20Box&pass=p%26ss%3D1' }]);
  });
  it('WLED : en POST sur 4.3.2.1', () => {
    const [step] = setupSteps('wled', 'Box', 'secret');
    expect(step).toMatchObject({ kind: 'http', method: 'POST', url: 'http://4.3.2.1/settings/wifi' });
    expect(step.kind === 'http' && step.body).toContain('CS0=Box&CP0=secret');
  });
  it('Magic Home : commandes AT en UDP', () => {
    const [step] = setupSteps('magichome', 'Box', 'secret');
    expect(step.kind === 'udp' && step.messages).toContain('AT+WSSSID=Box\r');
  });
  it('système fermé : rien à envoyer', () => {
    expect(setupSteps('closed', 'Box', 'x')).toEqual([]);
  });
});

describe('QR code d’un Wi-Fi', () => {
  it('lit le nom et le mot de passe', () => {
    expect(parseWifiQr('WIFI:T:WPA;S:SFR_B8E8;P:abc123;;')).toEqual({ ssid: 'SFR_B8E8', password: 'abc123' });
  });
  it('gère l’ordre libre et les caractères échappés', () => {
    expect(parseWifiQr(String.raw`WIFI:S:Ma\;Box;T:WPA;P:p\:a\\ss;H:false;;`)).toEqual({ ssid: 'Ma;Box', password: String.raw`p:a\ss` });
  });
  it('réseau ouvert : mot de passe vide', () => {
    expect(parseWifiQr('WIFI:T:nopass;S:Invités;;')).toEqual({ ssid: 'Invités', password: '' });
  });
  it('autre QR code : rien', () => {
    expect(parseWifiQr('https://example.com')).toBeNull();
  });
});
