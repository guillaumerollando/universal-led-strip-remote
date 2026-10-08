import { describe, expect, it } from 'vitest';
import { necPattern, patternDuration, REMOTE_24, REMOTE_44, repeatPattern } from '../ir';

/** Relit un motif comme le ferait un récepteur Arduino (IRremote, ancien format MSB d'abord). */
function decodeLegacy(pattern: number[]): number {
  let value = 0;
  for (let i = 3; i < pattern.length - 1; i += 2) value = ((value << 1) | (pattern[i] > 1000 ? 1 : 0)) >>> 0;
  return value;
}
const key = (remote: typeof REMOTE_24, id: string) => remote.keys.find((k) => k.id === id)!.command;

describe('NEC', () => {
  it('a la bonne forme : en-tête, 32 bits, bit de fin', () => {
    const p = necPattern([0x00, 0xef], 0x03);
    expect(p.length).toBe(2 + 64 + 1);
    expect(p.slice(0, 2)).toEqual([9000, 4500]);
    expect(patternDuration(p)).toBeLessThan(108000);
  });

  it('retrouve les codes connus de la télécommande 24 touches', () => {
    expect(decodeLegacy(necPattern(REMOTE_24.address, key(REMOTE_24, 'on')))).toBe(0x00f7c03f);
    expect(decodeLegacy(necPattern(REMOTE_24.address, key(REMOTE_24, 'off')))).toBe(0x00f740bf);
    expect(decodeLegacy(necPattern(REMOTE_24.address, key(REMOTE_24, 'r')))).toBe(0x00f720df);
    expect(decodeLegacy(necPattern(REMOTE_24.address, key(REMOTE_24, 'smooth')))).toBe(0x00f7e817);
  });

  it('retrouve les codes connus de la télécommande 44 touches', () => {
    expect(decodeLegacy(necPattern(REMOTE_44.address, key(REMOTE_44, 'power')))).toBe(0x00ff02fd);
    expect(decodeLegacy(necPattern(REMOTE_44.address, key(REMOTE_44, 'up')))).toBe(0x00ff3ac5);
    expect(decodeLegacy(necPattern(REMOTE_44.address, key(REMOTE_44, 'r')))).toBe(0x00ff1ae5);
    expect(decodeLegacy(necPattern(REMOTE_44.address, key(REMOTE_44, 'b')))).toBe(0x00ffa25d);
  });

  it('les télécommandes ont 24 et 44 touches aux commandes uniques', () => {
    for (const [remote, n] of [[REMOTE_24, 24], [REMOTE_44, 44]] as const) {
      expect(remote.keys).toHaveLength(n);
      expect(new Set(remote.keys.map((k) => k.command)).size).toBe(n);
      expect(new Set(remote.keys.map((k) => k.id)).size).toBe(n);
    }
  });

  it('répète une trame avec un silence pour tenir 108 ms', () => {
    const p = necPattern([0x00, 0xff], 0x40);
    const twice = repeatPattern(p, 2);
    expect(twice).toHaveLength(p.length * 2 + 1);
    expect(patternDuration(twice.slice(0, p.length + 1))).toBe(108000);
  });
});

describe('autres télécommandes', () => {
  it('retrouvent les codes de Flipper-IRDB', async () => {
    const { IR_REMOTES, probeKey } = await import('../ir');
    const legacy = (id: string, keyId: string) => {
      const r = IR_REMOTES.find((x) => x.id === id)!;
      return decodeLegacy(necPattern(r.address, r.keys.find((k) => k.id === keyId)!.command));
    };
    expect(legacy('bulb24', 'on')).toBe(0x00ffe01f);
    expect(legacy('bulb24', 'off')).toBe(0x00ff609f);
    expect(legacy('mp3-21', 'on')).toBe(0x00ffa25d);
    expect(legacy('ove', 'on')).toBe(0x40bf00ff);
    expect(legacy('ove', 'off')).toBe(0x40bf40bf);
    expect(legacy('idual', 'on')).toBe(0x407f807f);
    expect(new Set(IR_REMOTES.map((r) => r.id)).size).toBe(IR_REMOTES.length);
    for (const r of IR_REMOTES) expect(['power-off', 'power-toggle']).toContain(probeKey(r).kind);
  });
});

describe('24 touches variante FF et recherche approfondie', () => {
  it('retrouve les codes donnés par Guillaume', async () => {
    const { REMOTE_24_FF } = await import('../ir');
    const code = (id: string) => decodeLegacy(necPattern(REMOTE_24_FF.address, REMOTE_24_FF.keys.find((k) => k.id === id)!.command));
    expect(code('on')).toBe(0x00ff8877);
    expect(code('off')).toBe(0x00ffa857);
    expect(code('up')).toBe(0x00ff38c7);
    expect(code('down')).toBe(0x00ffb847);
    expect(code('r')).toBe(0x00ff18e7);
    expect(code('w')).toBe(0x00ffd827);
  });

  it('balaie 512 codes par lots de moins de 2 s', async () => {
    const { sweepCandidates, batchPattern, legacyCode, remoteForCode } = await import('../ir');
    const all = sweepCandidates();
    expect(all).toHaveLength(512);
    expect(patternDuration(batchPattern(all.slice(0, 16)))).toBeLessThan(2_000_000);
    expect(legacyCode({ address: [0x00, 0xef], command: 0x03 })).toBe('F7C03F');
    expect(legacyCode({ address: [0x00, 0xff], command: 0x11 })).toBe('FF8877');
    expect(remoteForCode({ address: [0x00, 0xff], command: 0x15 })?.id).toBe('nec24ff');
  });
});


describe('ON / OFF séparés', () => {
  it('essaie les vrais OFF avant la bascule 44 touches', async () => {
    const { PROBE_ORDER } = await import('../ir');
    const ids = PROBE_ORDER.map((r) => r.id);
    expect(ids.indexOf('nec44')).toBe(ids.length - 1);
    expect(ids.indexOf('bulb24')).toBeLessThan(ids.indexOf('nec44'));
  });

  it('combine les ON / OFF d’une télécommande 00 FF avec la 44 touches', async () => {
    const { IR_REMOTES, withSeparatePower, remoteById } = await import('../ir');
    const bulb = IR_REMOTES.find((r) => r.id === 'bulb24')!;
    const combo = withSeparatePower(bulb)!;
    expect(combo.id).toBe('nec44+bulb24');
    expect(combo.keys.find((k) => k.kind === 'power-off')?.command).toBe(0x06);
    expect(combo.keys.find((k) => k.kind === 'power-on')?.command).toBe(0x07);
    expect(combo.keys.some((k) => k.kind === 'power-toggle')).toBe(false);
    expect(combo.keys).toHaveLength(44);
    expect(remoteById('nec44+bulb24').id).toBe('nec44+bulb24');
    expect(withSeparatePower(IR_REMOTES.find((r) => r.id === 'nec24')!)).toBeNull(); // adresse 00 EF : pas compatible
  });
});


describe('envoi protégé contre la troncature de fin (émetteur MediaTek)', () => {
  it('un appui = la trame entière, puis deux « touche maintenue » de queue, en un seul envoi', async () => {
    const { pressPattern, NEC_REPEAT, fitsAndroid } = await import('../ir');
    const frame = necPattern([0x00, 0xef], 0x02);
    const p = pressPattern([0x00, 0xef], 0x02);
    expect(p.slice(0, frame.length)).toEqual(frame); // le code utile est en tête, intact
    expect(p.slice(-3)).toEqual([...NEC_REPEAT]);
    expect(p.filter((d) => d === 9000)).toHaveLength(3); // une trame + deux répétitions, jamais deux trames
    expect(patternDuration(p.slice(0, frame.length + 1))).toBe(108000);
    expect(fitsAndroid(p)).toBe(true);
  });

  it('une rafale de 15 codes + queue tient sous la limite de 2 s d’Android', async () => {
    const { burstPattern, fitsAndroid } = await import('../ir');
    const cands = Array.from({ length: 15 }, (_, i) => ({ address: [0x00, 0xff] as const, command: i }));
    expect(fitsAndroid(burstPattern(cands))).toBe(true);
    const tooMany = Array.from({ length: 20 }, (_, i) => ({ address: [0x00, 0xff] as const, command: i }));
    expect(fitsAndroid(burstPattern(tooMany))).toBe(false);
  });
});
