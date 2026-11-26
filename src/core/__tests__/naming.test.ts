import { describe, expect, it } from 'vitest';

import { nextFreeName, signalLevel } from '../naming';

const fr = (n: number): string => `Ruban ${n}`;

describe('nom proposé à l’ajout', () => {
  it('commence à 1', () => {
    expect(nextFreeName([], fr)).toBe('Ruban 1');
  });

  it('saute les noms déjà pris, sans tenir compte de la casse ni des espaces', () => {
    expect(nextFreeName(['Ruban 1', ' ruban 2 ', 'Néon salon'], fr)).toBe('Ruban 3');
  });

  it('reprend un numéro libéré', () => {
    expect(nextFreeName(['Ruban 1', 'Ruban 3'], fr)).toBe('Ruban 2');
  });

  it('suit le format de la langue', () => {
    expect(nextFreeName(['Strip 1'], (n) => `Strip ${n}`)).toBe('Strip 2');
  });
});

describe('force du signal', () => {
  it('traduit le RSSI en trois niveaux', () => {
    expect(signalLevel(-50)).toBe('near');
    expect(signalLevel(-70)).toBe('range');
    expect(signalLevel(-90)).toBe('far');
    expect(signalLevel(undefined)).toBeNull();
    expect(signalLevel(null)).toBeNull();
  });
});
