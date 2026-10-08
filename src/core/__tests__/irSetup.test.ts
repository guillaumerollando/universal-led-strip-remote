import { describe, expect, it } from 'vitest';

import type { IrCandidate } from '../ir';
import {
  answerHalving,
  BURST,
  burstPlan,
  FAMILIES,
  leadsFrom,
  remoteFromSetup,
  startHalving,
  suspectBursts,
  verifySteps,
  type BurstWindow,
  type IrFamily,
  type StripState,
} from '../irSetup';

/** Un faux ruban qui comprend les codes d'une famille et n'a de réaction visible que si quelque chose change. */
function fakeStrip(family: IrFamily, start: StripState) {
  const p = family.setup.power;
  const colorCodes = new Set(family.codes.map((c) => c.command).filter((c) => c !== p.on && c !== p.off && c !== p.toggle));
  let on = start === 'on';
  let color = -1;
  return {
    /** Applique un code ; renvoie true si le ruban a visiblement changé. */
    apply(c: IrCandidate): boolean {
      if (c.address[0] !== p.address[0] || c.address[1] !== p.address[1]) return false;
      if (c.command === p.toggle) return (on = !on), true;
      if (c.command === p.on) return on ? false : ((on = true), true);
      if (c.command === p.off) return on ? ((on = false), true) : false;
      if (colorCodes.has(c.command) && on && color !== c.command) return (color = c.command), true;
      return false;
    },
    get on() {
      return on;
    },
  };
}

const BURST_MS = BURST * 108;

/** L'assistant complet contre un faux ruban : rafales, tape, pistes, vérification. Renvoie la famille retenue. */
function runAssistant(truth: IrFamily, start: StripState, reaction = 650): string | null {
  const strip = fakeStrip(truth, start);
  const bursts = burstPlan(start);
  const windows: BurstWindow[] = [];
  let tapAt: number | null = null;
  for (let b = 0; b < bursts.length && tapAt === null; b++) {
    const t0 = b * BURST_MS;
    windows.push({ index: b, start: t0, end: t0 + BURST_MS });
    bursts[b].forEach((c, i) => {
      if (tapAt === null && strip.apply(c)) tapAt = t0 + i * 108 + reaction;
    });
  }
  if (tapAt === null) return null;
  const suspects = suspectBursts(windows, tapAt).flatMap((i) => bursts[i]);
  for (const lead of leadsFrom(suspects)) {
    if (lead.kind !== 'family') continue;
    // L'utilisateur tape si le ruban réagit pendant la vérification.
    if (verifySteps(lead.family, strip.on).some((s) => strip.apply(s.code))) return lead.family.id;
  }
  return 'codes-inconnus';
}

const fam = (id: string) => FAMILIES.find((f) => f.id === id)!;

describe('assistant : rafales puis affinage, contre de faux rubans avec un état', () => {
  for (const id of ['classic24', 'full44', 'ff24', 'bulb24', 'sylvania', 'mp3', 'jelly', 'strip8x', 'monster', 'ove', 'idual']) {
    for (const start of ['off', 'on'] as const) {
      it(`${id}, ruban ${start === 'on' ? 'allumé' : 'éteint'} au départ`, () => {
        expect(runAssistant(fam(id), start)).toBe(id);
      });
    }
  }

  it('réaction lente (1,3 s) : toujours trouvé', () => {
    expect(runAssistant(fam('full44'), 'off', 1300)).toBe('full44');
  });

  it('les codes adaptés à l’état passent en premier : un ruban éteint réagit dans les 2 premières rafales', () => {
    const plan = burstPlan('off');
    const onCodes = new Set(FAMILIES.map((f) => f.setup.power.on ?? f.setup.power.toggle));
    expect(plan[0].concat(plan[1] ?? []).filter((c) => onCodes.has(c.command)).length).toBeGreaterThanOrEqual(10);
  });

  it('toutes les rafales tiennent sous 2 s et l’ensemble passe en un peu plus d’une minute', () => {
    const plan = burstPlan('on');
    expect(Math.max(...plan.map((b) => b.length))).toBeLessThanOrEqual(BURST);
    expect(plan.length * BURST_MS).toBeLessThan(75_000);
  });
});

describe('codes inconnus et télécommande', () => {
  it('réduction par moitiés : isole un code parmi 32', () => {
    const codes: IrCandidate[] = Array.from({ length: 32 }, (_, i) => ({ address: [0, 0xff] as const, command: 0xa0 + i }));
    let h = startHalving(codes);
    for (let q = 0; q < 6; q++) {
      const r = answerHalving(h, h.testing.some((c) => c.command === 0xb3));
      if (r && 'command' in r) return expect(r.command).toBe(0xb3);
      if (!r) throw new Error('perdu');
      h = r;
    }
    throw new Error('trop de manches');
  });

  it('fabrique la télécommande : bascule + 20 couleurs pour la 44 touches', () => {
    const r = remoteFromSetup(fam('full44').setup);
    expect(r.keys.filter((k) => k.kind === 'power-toggle')).toHaveLength(1);
    expect(r.keys.filter((k) => k.kind === 'color')).toHaveLength(20);
  });
});
