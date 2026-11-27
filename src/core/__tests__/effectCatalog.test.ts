import { describe, expect, it } from 'vitest';

import { ELK_CATALOG, LEDNET_CATALOG, MELK_CATALOG } from '../effectCatalog';

describe('catalogue complet des effets', () => {
  it('MELK : les 220 effets, simplement numérotés (« Effet 33 »)', () => {
    expect(MELK_CATALOG).toHaveLength(220);
    expect(MELK_CATALOG.map((e) => e.code)).toEqual(Array.from({ length: 220 }, (_, i) => i + 1));
    const e = MELK_CATALOG.find((x) => x.code === 33)!;
    expect([e.parts, e.num]).toEqual([['Effet'], 33]);
  });

  it('ELK classique (22) et Magic Home / Triones (20) : codes connus, sans doublon', () => {
    for (const [list, n, from] of [
      [ELK_CATALOG, 22, 0x87],
      [LEDNET_CATALOG, 20, 0x25],
    ] as const) {
      expect(list).toHaveLength(n);
      expect(list.map((e) => e.code)).toEqual(Array.from({ length: n }, (_, i) => from + i));
      expect(new Set(list.map((e) => e.id)).size).toBe(n);
    }
  });
});
