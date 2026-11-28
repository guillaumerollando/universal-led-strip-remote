import { burstPattern, fitsAndroid, NEC_CARRIER_HZ, pressPattern, type IrCandidate, type IrKey, type IrRemote } from '../core/ir';

import native from '../../modules/led-strip-native/src';
import { t } from '../i18n';

function realEmitter(): boolean {
  try {
    return native?.hasIrEmitter() ?? false;
  } catch {
    return false;
  }
}

/**
 * En développement, sur un appareil sans émetteur (émulateur), on simule l'émission pour pouvoir voir l'assistant.
 * Jamais dans l'APK publié.
 */
const SIMULATED = __DEV__ && !realEmitter();

/** Le téléphone a-t-il un émetteur infrarouge (Xiaomi, Redmi, Poco, certains Honor…) ? */
export function hasIrEmitter(): boolean {
  return SIMULATED || realEmitter();
}

async function transmit(pattern: number[], frequency = NEC_CARRIER_HZ): Promise<void> {
  if (!fitsAndroid(pattern)) throw new Error(t('Signal infrarouge trop long.'));
  if (SIMULATED) {
    await new Promise((r) => setTimeout(r, Math.min(1800, pattern.reduce((a, b) => a + b, 0) / 1000)));
    return;
  }
  if (!native) throw new Error(t('L’infrarouge n’est disponible que sur Android.'));
  try {
    await native.transmitIr(frequency, pattern);
  } catch (e) {
    console.warn(`[IR] échec de l'émission : ${(e as Error).message}`);
    throw e;
  }
}

/** Émet un appui sur une touche : un seul envoi, la trame puis la queue protectrice. */
export async function sendIrKey(remote: IrRemote, key: IrKey): Promise<void> {
  if (!hasIrEmitter()) throw new Error(t('Ce téléphone n’a pas d’émetteur infrarouge.'));
  await transmit(pressPattern(remote.address, key.command));
}

/** Envoie une série de codes : rafales de 15 en un seul envoi chacune (avec la queue protectrice). */
export async function sendIrBatch(candidates: IrCandidate[]): Promise<void> {
  if (!hasIrEmitter()) throw new Error(t('Ce téléphone n’a pas d’émetteur infrarouge.'));
  for (let i = 0; i < candidates.length; i += 15) {
    await transmit(burstPattern(candidates.slice(i, i + 15)));
    if (i + 15 < candidates.length) await new Promise((r) => setTimeout(r, 60));
  }
}

/** La consigne de visée. */
export function irAimHint(): string {
  // Portée constatée le 2026-10-08 chez Guillaume : ~30 cm avec le Redmi, contre ~4 m pour la télécommande d'origine.
  return t(
    'Approche le haut du téléphone à 30 cm maximum du petit boîtier sur le câble du ruban : l’émetteur d’un téléphone porte bien moins loin qu’une télécommande.',
  );
}
