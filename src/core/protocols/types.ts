import type { ElkEffect, Rgb } from '../elk';

/** Un effet intégré au contrôleur (même forme pour toutes les familles : identifiant, libellé français, code, aperçu). */
export type Effect = ElkEffect;
export type { Rgb };

/** Une requête HTTP vers un appareil du réseau local (chemin relatif : l'adresse vient de l'appareil). */
export interface HttpCall {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
  /** Port, si ce n'est pas 80. */
  port?: number;
}

/** Comment écrire à un contrôleur Bluetooth : service, caractéristique, trames d'ouverture. */
export interface BleProfile {
  service: string;
  write: string;
  /** Écriture avec accusé (nécessaire pour les lampes qui exigent un appairage, comme Hue). */
  withResponse?: boolean;
  /** Trames à envoyer juste après la connexion. */
  init?: number[][];
}

/** UUID Bluetooth 16 bits → forme longue. */
export const uuid16 = (short: string): string => `0000${short.toLowerCase()}-0000-1000-8000-00805f9b34fb`;

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(v)));

/** Couleur ramenée à une luminosité (0-100) : pour les contrôleurs sans commande de luminosité. */
export const dim = ({ r, g, b }: Rgb, percent: number): Rgb => {
  const k = clamp(percent, 0, 100) / 100;
  return { r: Math.round(r * k), g: Math.round(g * k), b: Math.round(b * k) };
};

/** Somme des octets modulo 256 (somme de contrôle Magic Home / Triones). */
export const checksum = (bytes: number[]): number => bytes.reduce((a, b) => a + b, 0) & 0xff;
