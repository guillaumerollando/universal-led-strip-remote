import { describe, expect, it } from 'vitest';
import { widgetRooms } from '../widget';

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
