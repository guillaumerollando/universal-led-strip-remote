import type { Transport } from '../core/families';
import { nextFreeName, signalLevel } from '../core/naming';
import { getDevices } from '../services/store';
import { t } from '../i18n';

/** Ce qu'est l'appareil, en mots de tous les jours (jamais le nom du contrôleur). */
export function kindLabel(transport: Transport): string {
  return transport === 'ble' ? t('Ruban Bluetooth') : transport === 'wifi' ? t('Ruban Wi-Fi') : t('Ruban à télécommande');
}

/** Force du signal Bluetooth en mots, ou null si inconnue. */
export function signalText(rssi?: number | null): string | null {
  const level = signalLevel(rssi);
  return level === 'near' ? t('tout près') : level === 'range' ? t('à portée') : level === 'far' ? t('loin') : null;
}

/** Le nom proposé à l'ajout : « Ruban 1 », « Ruban 2 »… sans doublon, pour ne jamais bloquer. */
export const defaultStripName = (): string => nextFreeName(getDevices().map((d) => d.name), (n) => t('Ruban {n}', { n }));
