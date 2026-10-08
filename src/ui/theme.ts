/**
 * Direction artistique : « la lumière d'abord ».
 * Fond de nuit presque noir, surfaces à peine visibles ; la seule vraie couleur vient des rubans eux-mêmes
 * (leur dernière couleur connue) et d'un accent chaud de filament pour l'interface.
 */
export const colors = {
  bg: '#0A0B0F',
  surface: '#14161D',
  surfaceHigh: '#1D2029',
  border: '#262A35',
  text: '#F4F1EA',
  textDim: '#8E93A3',
  /** Filament chaud : boutons, sélection. */
  accent: '#FFB547',
  accentText: '#1A1206',
  ok: '#5BD68A',
  warn: '#FFB547',
  danger: '#FF6B6B',
  /** Ruban éteint. */
  off: '#2A2E39',
};

/** Lumière par défaut d'un ruban allumé dont on ne connaît pas la couleur : blanc chaud. */
export const WARM_WHITE = { r: 255, g: 196, b: 120 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const font = { small: 13, body: 15, title: 18, big: 22, hero: 30 };

export const rgbCss = ({ r, g, b }: { r: number; g: number; b: number }, alpha = 1): string =>
  `rgba(${r},${g},${b},${alpha})`;
