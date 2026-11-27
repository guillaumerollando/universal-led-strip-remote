import { describe, expect, it } from 'vitest';
import { sceneColors, widgetPlaces, widgetRooms } from '../widget';

const labels = { all: 'Tous', on: (n: string) => `${n} : éteindre`, off: (n: string) => `${n} : allumer` };

describe('widget « Pièces »', () => {
  it('une ligne par pièce qui a des rubans, avec son état', () => {
    const rooms = [
      { id: 'r1', name: 'Salon' },
      { id: 'r2', name: 'Vide' },
      { id: 'r3', name: 'Chambre' },
    ];
    const devices = [{ roomId: 'r1', state: { on: true } }, { roomId: 'r3' }];
    expect(widgetRooms(rooms, devices, labels)).toEqual([
      { name: 'Salon', on: true, link: 'ledstrip://power?room=r1', label: 'Salon : éteindre' },
      { name: 'Chambre', on: false, link: 'ledstrip://power?room=r3', label: 'Chambre : allumer' },
    ]);
  });
  it('sans pièce : « Tous les rubans » ; sans ruban : rien', () => {
    expect(widgetRooms([], [{ state: { on: false } }], labels)).toEqual([{ name: 'Tous', on: false, link: 'ledstrip://power?all=1', label: 'Tous : allumer' }]);
    expect(widgetRooms([], [], labels)).toEqual([]);
  });
});

describe('widgets « Pièce » et « Ambiance »', () => {
  it('donne chaque pièce avec ses ambiances, leurs liens et leurs couleurs', () => {
    const places = widgetPlaces(
      [
        { id: 'r1', name: 'Chambre' },
        { id: 'r2', name: 'Vide' },
      ],
      [{ roomId: 'r1', state: { on: true } }],
      () => [{ id: 'love', name: 'Love', colors: [{ r: 255, g: 0, b: 80 }, { r: 255, g: 0, b: 80 }, { r: 0, g: 0, b: 0 }] }],
      labels,
    );
    expect(places).toEqual([
      {
        id: 'r1',
        name: 'Chambre',
        on: true,
        link: 'ledstrip://power?room=r1',
        label: 'Chambre : éteindre',
        scenes: [{ id: 'love', name: 'Love', link: 'ledstrip://scene?room=r1&scene=love', colors: ['#ff0050'] }],
      },
    ]);
  });

  it('une ambiance sans couleur visible prend le blanc chaud de l’appli', () => {
    expect(sceneColors([{ r: 0, g: 0, b: 0 }])).toEqual(['#ffb547']);
  });
});
