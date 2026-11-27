/**
 * Ajout par adresse IP (pour les bricoleurs) : à partir des réponses des API locales connues, dire ce qu'est
 * l'appareil. Pur : `services/probe.ts` fait les requêtes et passe les réponses (null = pas de réponse).
 */
import type { DetectedDevice } from './identify';
import { parseMhState } from './protocols/magicHome';
import { isOpenBeken, obkMac } from './protocols/openbeken';
import { parseElgatoInfo, parseShellyInfo, parseTasmotaStatus, parseWledInfo } from './protocols/wifi';

export interface ProbeAnswers {
  wled?: unknown;
  shelly?: unknown;
  tasmota?: unknown;
  elgato?: unknown;
  magicHome?: number[];
}

export const isIpv4 = (ip: string): boolean =>
  /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(ip.trim()) && ip.trim().split('.').every((n) => Number(n) <= 255);

export function classifyProbe(ip: string, a: ProbeAnswers): DetectedDevice | null {
  const base = { confidence: 'sure' as const, transport: 'wifi' as const, address: ip };
  const wled = parseWledInfo(a.wled);
  if (wled) return { ...base, key: `wifi:wled:${ip}`, family: 'wled', rawName: wled.name };
  const shelly = parseShellyInfo(a.shelly);
  if (shelly) return { ...base, key: `wifi:shelly:${ip}`, family: 'shelly', rawName: shelly.model, model: shelly.model, meta: { shelly: shelly.kind } };
  const tasmota = parseTasmotaStatus(a.tasmota);
  if (tasmota && isOpenBeken(a.tasmota)) {
    return { ...base, key: `wifi:openbeken:${obkMac(a.tasmota) ?? ip}`, family: 'openbeken', rawName: tasmota.name };
  }
  if (tasmota) return { ...base, key: `wifi:tasmota:${ip}`, family: 'tasmota', rawName: tasmota.name };
  const elgato = parseElgatoInfo(a.elgato);
  if (elgato) return { ...base, key: `wifi:elgato:${ip}`, family: 'elgato', rawName: elgato.name, model: elgato.name, meta: { color: elgato.color ? '1' : '0' } };
  if (a.magicHome && parseMhState(a.magicHome)) return { ...base, key: `wifi:magichome:${ip}`, family: 'magichome-wifi', rawName: 'Magic Home' };
  return null;
}
