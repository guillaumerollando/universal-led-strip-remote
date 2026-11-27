import { describe, expect, it } from 'vitest';

import { elgatoWhite, goveeWhite, hueWhite, nanoleafWhite, tasmotaWhite } from '../protocols/wifi';
import { lifxWhite, yeelightWhite } from '../protocols/udp';
import { hueBleWhite } from '../protocols/ble';
import { kelvinAt, kelvinPosition, kelvinToMired, kelvinToRgb, KELVIN_MAX, KELVIN_MIN, WHITES } from '../white';

describe('blancs chaud / froid', () => {
  it('couleur approchée : chaud = orangé, froid = presque blanc bleuté', () => {
    const candle = kelvinToRgb(1900);
    expect(candle.r).toBe(255);
    expect(candle.b).toBeLessThan(60);
    const day = kelvinToRgb(6500);
    expect(day.r).toBeGreaterThan(240);
    expect(day.b).toBeGreaterThan(230);
  });

  it('curseur et mireds', () => {
    expect(kelvinAt(0)).toBe(KELVIN_MIN);
    expect(kelvinAt(1)).toBe(KELVIN_MAX);
    expect(kelvinAt(kelvinPosition(4000))).toBe(4000);
    expect(kelvinToMired(2700)).toBe(370);
    expect(kelvinToMired(10000)).toBe(153);
    expect(WHITES.map((w) => w.kelvin)).toEqual([1900, 2700, 4000, 6000]);
  });

  it('commandes de chaque marque (à confirmer sur de vraies ampoules)', () => {
    expect(yeelightWhite(2700)).toContain('"method":"set_ct_abx","params":[2700,"smooth",300]');
    expect(tasmotaWhite(2700).path).toBe(`/cm?cmnd=${encodeURIComponent('CT 370')}`);
    expect(hueWhite('u', '1', 2700).body).toEqual({ on: true, ct: 370 });
    expect(elgatoWhite(2900).body).toEqual({ numberOfLights: 1, lights: [{ on: 1, temperature: 344 }] });
    expect(nanoleafWhite('tok', 4000).body).toEqual({ ct: { value: 4000 } });
    expect(JSON.parse(goveeWhite(1500)).msg.data.colorTemInKelvin).toBe(2000);
    expect(hueBleWhite(2700)).toEqual([370 & 0xff, 370 >> 8]);
    // LIFX : saturation nulle, température en fin de HSBK (avant la durée).
    const f = lifxWhite([1, 2, 3, 4, 5, 6], 3000, 50);
    const k = f[f.length - 6] | (f[f.length - 5] << 8);
    expect(k).toBe(3000);
  });
});

import { lightKind } from '../describe';

describe('ruban, ampoule ou lumière', () => {
  it('d’après la famille et le modèle', () => {
    expect(lightKind({ family: 'elk-bledom', rawName: 'MELK-OA21' })).toBe('strip');
    expect(lightKind({ family: 'yeelight', rawName: 'Yeelight', model: 'color4' })).toBe('bulb');
    expect(lightKind({ family: 'yeelight', rawName: 'Yeelight', model: 'stripe' })).toBe('strip');
    expect(lightKind({ family: 'hue', rawName: 'Bureau', meta: { product: 'Hue white ambiance' } })).toBe('bulb');
    expect(lightKind({ family: 'hue', rawName: 'Télé', meta: { product: 'Hue lightstrip plus' } })).toBe('strip');
    expect(lightKind({ family: 'lifx', rawName: 'Chambre' })).toBe('bulb');
    expect(lightKind({ family: 'govee-lan', rawName: 'Govee', model: 'H6008' })).toBe('bulb');
    expect(lightKind({ family: 'govee-lan', rawName: 'Govee', model: 'H6159' })).toBe('strip');
    expect(lightKind({ family: 'openbeken', rawName: 'obkE187799A', meta: { pixels: '200' } })).toBe('strip');
    expect(lightKind({ family: 'tasmota', rawName: 'Lampe salon' })).toBe('bulb');
    expect(lightKind({ family: 'nanoleaf', rawName: 'Shapes' })).toBe('light');
  });
});
