import { classifyProbe } from '../core/probe';
import { MAGIC_HOME_TCP_PORT, MH_QUERY } from '../core/protocols/magicHome';
import { ELGATO_INFO, SHELLY_INFO, TASMOTA_STATUS, WLED_INFO } from '../core/protocols/wifi';
import type { DetectedDevice } from '../core/identify';
import { http, tcp } from './net';
import { obkPixelMeta } from './openbeken';

/** Interroge toutes les API locales connues à cette adresse, en parallèle (2,5 s max). */
export async function probeIp(ip: string): Promise<DetectedDevice | null> {
  const ask = <T,>(p: Promise<T>): Promise<T | undefined> => p.catch(() => undefined);
  const [wled, shelly, tasmota, elgato, magicHome] = await Promise.all([
    ask(http(ip, WLED_INFO, 2500)),
    ask(http(ip, SHELLY_INFO, 2500)),
    ask(http(ip, TASMOTA_STATUS, 2500)),
    ask(http(ip, ELGATO_INFO, 2500)),
    ask(tcp(ip, MAGIC_HOME_TCP_PORT, MH_QUERY, 14, 2500)),
  ]);
  const found = classifyProbe(ip, { wled, shelly, tasmota, elgato, magicHome });
  // Ruban libéré (OpenBeken) : est-ce un ruban à pixels, et combien de LED ?
  return found?.family === 'openbeken' ? { ...found, meta: { ...found.meta, ...(await obkPixelMeta(ip)) } } : found;
}
