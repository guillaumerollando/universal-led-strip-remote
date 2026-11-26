/**
 * mDNS / DNS-SD minimal (RFC 6762 / 6763) : construire une question « qui offre tel service ? »
 * et lire les réponses (PTR, SRV, TXT, A). Sert à trouver WLED, Hue, Nanoleaf, Elgato, Shelly, ESPHome.
 * Pur TypeScript : la socket UDP est dans `services/lan.ts`.
 */

export const MDNS_ADDRESS = '224.0.0.251';
export const MDNS_PORT = 5353;

/** Services cherchés, et la famille qu'ils signalent. */
export const MDNS_SERVICES = {
  '_wled._tcp.local': 'wled',
  '_hue._tcp.local': 'hue-bridge',
  '_nanoleafapi._tcp.local': 'nanoleaf',
  '_elg._tcp.local': 'elgato',
  '_shelly._tcp.local': 'shelly',
  '_http._tcp.local': 'http',
  '_esphomelib._tcp.local': 'esphome',
} as const;
export type MdnsService = keyof typeof MDNS_SERVICES;

const TYPE = { A: 1, PTR: 12, TXT: 16, SRV: 33 } as const;

/** UTF-8 sans TextEncoder / TextDecoder (absents de certaines versions de Hermes). */
const utf8 = (s: string): number[] => [...unescape(encodeURIComponent(s))].map((c) => c.charCodeAt(0));
function fromUtf8(bytes: number[]): string {
  const raw = String.fromCharCode(...bytes);
  try {
    return decodeURIComponent(escape(raw));
  } catch {
    return raw;
  }
}

function encodeName(name: string): number[] {
  const out: number[] = [];
  for (const label of name.split('.').filter(Boolean)) {
    const bytes = utf8(label);
    out.push(bytes.length, ...bytes);
  }
  out.push(0);
  return out;
}

/**
 * Question PTR pour chaque service, bit « réponse en direct » (QU) levé : les appareils répondent
 * directement à notre port, sans qu'on ait besoin d'écouter le port 5353 (souvent pris par Android).
 */
export function mdnsQuery(services: string[]): number[] {
  const out = [0, 0, 0, 0, (services.length >> 8) & 0xff, services.length & 0xff, 0, 0, 0, 0, 0, 0];
  for (const s of services) out.push(...encodeName(s), 0, TYPE.PTR, 0x80, 0x01);
  return out;
}

export interface MdnsRecord {
  name: string;
  type: number;
  data: string | string[] | { port: number; target: string };
}

function readName(buf: number[], start: number): { name: string; next: number } {
  const labels: string[] = [];
  let pos = start;
  let next = -1;
  for (let guard = 0; guard < 64; guard++) {
    const len = buf[pos];
    if (len === undefined) break;
    if (len === 0) {
      pos += 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      // Pointeur de compression : la suite du nom est ailleurs dans le paquet.
      if (next < 0) next = pos + 2;
      pos = ((len & 0x3f) << 8) | buf[pos + 1];
      continue;
    }
    labels.push(fromUtf8(buf.slice(pos + 1, pos + 1 + len)));
    pos += 1 + len;
  }
  return { name: labels.join('.'), next: next >= 0 ? next : pos };
}

/** Lit toutes les réponses d'un paquet mDNS (questions ignorées). Renvoie [] si le paquet est illisible. */
export function parseMdns(bytes: Uint8Array | number[]): MdnsRecord[] {
  const buf = [...bytes];
  if (buf.length < 12) return [];
  const u16 = (o: number): number => (buf[o] << 8) | buf[o + 1];
  const qd = u16(4);
  const total = u16(6) + u16(8) + u16(10);
  let pos = 12;
  try {
    for (let i = 0; i < qd; i++) pos = readName(buf, pos).next + 4;
    const records: MdnsRecord[] = [];
    for (let i = 0; i < total && pos < buf.length; i++) {
      const { name, next } = readName(buf, pos);
      const type = u16(next);
      const len = u16(next + 8);
      const rd = next + 10;
      if (type === TYPE.PTR) records.push({ name, type, data: readName(buf, rd).name });
      else if (type === TYPE.A && len === 4) records.push({ name, type, data: buf.slice(rd, rd + 4).join('.') });
      else if (type === TYPE.SRV) records.push({ name, type, data: { port: u16(rd + 4), target: readName(buf, rd + 6).name } });
      else if (type === TYPE.TXT) {
        const txt: string[] = [];
        for (let p = rd; p < rd + len; ) {
          const l = buf[p];
          if (l) txt.push(fromUtf8(buf.slice(p + 1, p + 1 + l)));
          p += 1 + l;
        }
        records.push({ name, type, data: txt });
      }
      pos = rd + len;
    }
    return records;
  } catch {
    return [];
  }
}

export interface MdnsDevice {
  service: MdnsService;
  /** Nom de l'instance (« WLED-Salon »). */
  instance: string;
  ip?: string;
  port?: number;
  txt: Record<string, string>;
}

/** Regroupe les enregistrements d'un paquet en appareils (instance → IP, port, TXT). */
export function mdnsDevices(records: MdnsRecord[], fromIp?: string): MdnsDevice[] {
  const out: MdnsDevice[] = [];
  for (const ptr of records.filter((r) => r.type === TYPE.PTR)) {
    const service = ptr.name.toLowerCase() as MdnsService;
    if (!(service in MDNS_SERVICES)) continue;
    const full = ptr.data as string;
    const srv = records.find((r) => r.type === TYPE.SRV && r.name === full)?.data as { port: number; target: string } | undefined;
    const a = srv && records.find((r) => r.type === TYPE.A && r.name === srv.target);
    const txtList = (records.find((r) => r.type === TYPE.TXT && r.name === full)?.data as string[] | undefined) ?? [];
    const txt: Record<string, string> = {};
    for (const kv of txtList) {
      const i = kv.indexOf('=');
      if (i > 0) txt[kv.slice(0, i).toLowerCase()] = kv.slice(i + 1);
    }
    out.push({
      service,
      instance: full.slice(0, full.length - service.length - 1) || full,
      ip: (a?.data as string | undefined) ?? fromIp,
      port: srv?.port,
      txt,
    });
  }
  return out;
}

/** Encodeur de réponse (pour les tests) : PTR + SRV + TXT + A, sans compression. */
export function mdnsAnswerForTest(service: string, instance: string, ip: string, port: number, txt: string[]): number[] {
  const full = `${instance}.${service}`;
  const host = `${instance.replace(/\s+/g, '-')}.local`;
  const rr = (name: string, type: number, rdata: number[]): number[] => [
    ...encodeName(name), 0, type, 0x80, 1, 0, 0, 0x11, 0x94, (rdata.length >> 8) & 0xff, rdata.length & 0xff, ...rdata,
  ];
  const txtData = txt.flatMap((s) => {
    const b = utf8(s);
    return [b.length, ...b];
  });
  return [
    0, 0, 0x84, 0, 0, 0, 0, 4, 0, 0, 0, 0,
    ...rr(service, TYPE.PTR, encodeName(full)),
    ...rr(full, TYPE.SRV, [0, 0, 0, 0, (port >> 8) & 0xff, port & 0xff, ...encodeName(host)]),
    ...rr(full, TYPE.TXT, txtData),
    ...rr(host, TYPE.A, ip.split('.').map(Number)),
  ];
}
