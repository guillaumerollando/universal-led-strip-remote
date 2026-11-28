import { describe, expect, it } from 'vitest';

import { BUILTIN_AMBIANCES } from '../ambiances';

describe('ambiances pour les rubans Bluetooth MELK (choisies par Guillaume sur son MELK-OA21)', () => {
  it('reprend exactement la sélection validée, sans Halloween', () => {
    const melk = Object.fromEntries(BUILTIN_AMBIANCES.filter((a) => a.melk).map((a) => [a.id, a.melk]));
    expect(melk).toEqual({
      christmas: { effect: 5, speed: 60 },
      autumn: { color: { r: 255, g: 80, b: 0 } },
      aurora: { effect: 204, speed: 40 },
      romantic: { effect: 35, speed: 60 },
      ocean: { effect: 207, speed: 60 },
      miami: { effect: 9, speed: 35 },
      forest: { effect: 27, speed: 60 },
    });
  });

  it('les effets existent dans le catalogue du MELK (1 à 220)', () => {
    for (const a of BUILTIN_AMBIANCES) {
      if (a.melk && 'effect' in a.melk) expect(a.melk.effect).toBeGreaterThanOrEqual(1);
      if (a.melk && 'effect' in a.melk) expect(a.melk.effect).toBeLessThanOrEqual(220);
    }
  });

  it('chaque ambiance a sa version simple (télécommande, ruban à couleur unie)', () => {
    for (const a of BUILTIN_AMBIANCES) {
      expect(a.simple, a.id).toBeDefined();
      const { r, g, b } = a.simple!.color;
      expect(r + g + b, a.id).toBeGreaterThan(0);
    }
  });
});
