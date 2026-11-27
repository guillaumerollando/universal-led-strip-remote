import * as Network from 'expo-network';

import type { DetectedDevice } from '../core/identify';
import { classifyProbe } from '../core/probe';
import { TASMOTA_STATUS } from '../core/protocols/wifi';
import { http } from './net';
import { obkPixelMeta } from './openbeken';

/**
 * Tasmota et OpenBeken ne s'annoncent pas toujours sur le réseau (OpenBeken jamais) : on frappe à chaque adresse
 * du sous-réseau (/24) avec « Status 0 », quelques-unes à la fois, délai court. ~10 s pour tout le réseau.
 * Renvoie une fonction d'arrêt.
 */
export function sweepSubnet(onDevice: (d: DetectedDevice) => void, concurrency = 24, timeoutMs = 1500): () => void {
  let stopped = false;
  void (async () => {
    const ip = await Network.getIpAddressAsync().catch(() => null);
    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip) || ip === '0.0.0.0') return;
    const prefix = ip.replace(/\.\d+$/, '.');
    const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}${i + 1}`).filter((h) => h !== ip);
    const worker = async (): Promise<void> => {
      for (let host = hosts.shift(); host && !stopped; host = hosts.shift()) {
        const status = await http(host, TASMOTA_STATUS, timeoutMs).catch(() => undefined);
        if (stopped || status === undefined) continue;
        const found = classifyProbe(host, { tasmota: status });
        if (!found) continue;
        onDevice(found.family === 'openbeken' ? { ...found, meta: { ...found.meta, ...(await obkPixelMeta(host)) } } : found);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  })();
  return () => {
    stopped = true;
  };
}
