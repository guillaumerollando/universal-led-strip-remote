import { describe, expect, it } from 'vitest';

import { REMOTE_24 } from '../ir';
import { captureScene, nearestColorKey, PRESET_SCENES, presetItem } from '../scenes';

describe('ambiances de pièce', () => {
  it('retient chaque ruban tel quel, avec son motif s’il en joue un', () => {
    const scene = captureScene(
      'salon',
      ' Soirée ',
      [
        { key: 'a', state: { on: true, rgb: { r: 255, g: 0, b: 0 }, brightness: 40 } },
        { key: 'b', state: { on: true, effect: 'obk-motif', speed: 20 }, meta: { motif: '*ff0000,000000' } },
        { key: 'c', state: { on: false } },
      ],
      'id1',
    );
    expect(scene).toEqual({
      id: 'id1',
      roomId: 'salon',
      name: 'Soirée',
      mine: true,
      items: [
        { key: 'a', on: true, rgb: { r: 255, g: 0, b: 0 }, brightness: 40, effect: undefined, speed: undefined, motif: undefined },
        { key: 'b', on: true, rgb: undefined, brightness: undefined, effect: 'obk-motif', speed: 20, motif: '*ff0000,000000' },
        { key: 'c', on: false, rgb: undefined, brightness: undefined, effect: undefined, speed: undefined, motif: undefined },
      ],
    });
  });

  it('une ambiance de l’appli prend l’effet que le ruban connaît, sinon la couleur', () => {
    const party = PRESET_SCENES.find((p) => p.id === 'party')!;
    expect(presetItem(party, 'x', ['fade7', 'jump7'])).toMatchObject({ effect: 'jump7', on: true });
    expect(presetItem(party, 'x', [])).toMatchObject({ rgb: party.rgb, on: true, brightness: 100 });
    // Cocooning : l'ambiance Automne si le ruban la connaît, sinon sa couleur orangée.
    const cosy = PRESET_SCENES.find((p) => p.id === 'cosy')!;
    expect(presetItem(cosy, 'x', [], ['autumn', 'aurora'])).toEqual({ key: 'x', on: true, effect: 'obk-amb:autumn' });
    expect(presetItem(cosy, 'x', [], [])).toMatchObject({ rgb: cosy.rgb, on: true });
  });

  it('infrarouge : la touche de couleur la plus proche', () => {
    expect(nearestColorKey(REMOTE_24.keys, { r: 250, g: 10, b: 5 })?.rgb).toEqual({ r: 255, g: 0, b: 0 });
    expect(nearestColorKey([], { r: 0, g: 0, b: 0 })).toBeUndefined();
  });
});
