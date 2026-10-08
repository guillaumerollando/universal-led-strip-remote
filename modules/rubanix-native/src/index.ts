import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface RubanixNativeModule {
  hasIrEmitter(): boolean;
  getIrCarrierFrequencies(): [number, number][];
  transmitIr(frequency: number, pattern: number[]): Promise<void>;
  /** Renvoie la durée (µs) de chaque appel au pilote. */
  transmitSequence(frequency: number, frames: number[][], periodMs: number): Promise<number[]>;
  acquireMulticastLock(): void;
  releaseMulticastLock(): void;
}

/** Module natif (Android seulement) ; `null` ailleurs ou dans Expo Go. */
const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<RubanixNativeModule>('RubanixNative') : null;

export default native;
