import { lightKind, type LightKind } from '../core/describe';
import type { FamilyId, Transport } from '../core/families';
import { nextFreeName, signalLevel } from '../core/naming';
import { getDevices } from '../services/store';
import { t } from '../i18n';

type Kindable = { transport: Transport; family: FamilyId; rawName: string; model?: string; meta?: Record<string, string> };

/** Ce qu'est l'appareil, en mots de tous les jours (jamais le nom du contrôleur) : ruban, ampoule ou lumière. */
export function kindLabel(d: Kindable): string {
  if (d.transport === 'ir') return t('Ruban à télécommande');
  const kind = lightKind(d);
  if (d.transport === 'ble') return kind === 'bulb' ? t('Ampoule Bluetooth') : kind === 'light' ? t('Lumière Bluetooth') : t('Ruban Bluetooth');
  return kind === 'bulb' ? t('Ampoule Wi-Fi') : kind === 'light' ? t('Lumière Wi-Fi') : t('Ruban Wi-Fi');
}

/** Force du signal Bluetooth en mots, ou null si inconnue. */
export function signalText(rssi?: number | null): string | null {
  const level = signalLevel(rssi);
  return level === 'near' ? t('tout près') : level === 'range' ? t('à portée') : level === 'far' ? t('loin') : null;
}

/** Le nom proposé à l'ajout : « Ruban 1 », « Ampoule 2 », « Lumière 1 »… sans doublon, pour ne jamais bloquer. */
export const defaultName = (kind: LightKind = 'strip'): string =>
  nextFreeName(
    getDevices().map((d) => d.name),
    (n) => (kind === 'bulb' ? t('Ampoule {n}', { n }) : kind === 'light' ? t('Lumière {n}', { n }) : t('Ruban {n}', { n })),
  );
