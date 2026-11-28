import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface LedStripNativeModule {
  hasIrEmitter(): boolean;
  getIrCarrierFrequencies(): [number, number][];
  transmitIr(frequency: number, pattern: number[]): Promise<void>;
  /** Renvoie la durée (µs) de chaque appel au pilote. */
  transmitSequence(frequency: number, frames: number[][], periodMs: number): Promise<number[]>;
  /** Requête TCP courte ; `replyBytes` : 0 = ne rien lire, -1 = jusqu'au saut de ligne. */
  tcpRequest(host: string, port: number, payload: number[], replyBytes: number, timeoutMs: number): Promise<number[]>;
  /** Widget « Pièces » : pièces en JSON [{name, on, link, label}] et texte quand il n'y en a aucune. */
  setWidgetRooms(rooms: string, empty: string): void;
  /** Widgets « Pièce » et « Ambiance » : pièces en JSON [{id, name, on, link, label, scenes}] et texte d'un widget non réglé. */
  setWidgetPlaces?(places: string, empty: string): void;
  /**
   * Propose de poser un widget sur l'écran d'accueil (Android 8+, si le lanceur le permet) : `room` = une pièce,
   * `ambiance` = une ambiance de cette pièce. Renvoie false si le lanceur ne sait pas le faire.
   */
  pinWidget?(kind: 'room' | 'ambiance', roomId: string, sceneId: string): boolean;
  /** Remet l'appli en arrière-plan. */
  moveToBack(): boolean;
  acquireMulticastLock(): void;
  /** Configurer une lumière Wi-Fi neuve : réseaux autour, réseau actuel, état (Wi-Fi, localisation, connexion depuis l'appli). */
  wifiScan?(): Promise<{ ssid: string; frequency: number; level: number; secure: boolean }[]>;
  wifiCurrentSsid?(): string | null;
  wifiSetupState?(): [wifiOn: boolean, locationOn: boolean, canConnect: boolean];
  /** Se connecte au réseau de la lumière (Android demande l'accord) ; true une fois connecté. */
  wifiConnectAp?(ssid: string, password: string | null, timeoutMs: number): Promise<boolean>;
  /** Requête HTTP par le réseau de la lumière : [statut, corps] ; statut -1 si elle a coupé en route, -2 injoignable. */
  apHttp?(method: string, url: string, body: string | null, contentType: string | null, timeoutMs: number): Promise<[number, string]>;
  apUdp?(host: string, port: number, messages: string[], waitMs: number): Promise<string[]>;
  wifiReleaseAp?(): void;
  /** Lit un QR code (lecteur de Google, sans autorisation caméra) : son texte, ou null si annulé. */
  scanQrCode?(): Promise<string | null>;
  /** Choisit une image (capture d'écran) et y lit le QR code : son texte, "" si aucun, null si annulé. */
  readQrFromImage?(): Promise<string | null>;
  /** Fenêtre officielle d'avis du Play Store (Google décide s'il l'affiche). */
  requestReview?(): Promise<boolean>;
  /** « onShake » : le téléphone a été secoué (signaler un problème). */
  addListener?(event: 'onShake', listener: () => void): { remove(): void };
  releaseMulticastLock(): void;
}

/** Module natif (Android seulement) ; `null` ailleurs ou dans Expo Go. */
const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<LedStripNativeModule>('LedStripNative') : null;

export default native;
