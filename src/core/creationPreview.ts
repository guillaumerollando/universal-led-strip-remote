/**
 * Aperçu animé d'une création dans l'appli : ce que fera le ruban, en miniature (une rangée de `n` LED). Pur et
 * déterministe (`frame` = numéro d'image, une image toutes les ~80 ms), pour l'écran « Créer mon ambiance ».
 */
import { snakeOf, type Creation } from './creations';
import type { Rgb } from './protocols/types';

const OFF: Rgb = { r: 0, g: 0, b: 0 };
const mix = (a: Rgb, b: Rgb, k: number): Rgb => ({
  r: Math.round(a.r + (b.r - a.r) * k),
  g: Math.round(a.g + (b.g - a.g) * k),
  b: Math.round(a.b + (b.b - a.b) * k),
});
/** Hasard reproductible (même image → même résultat). */
const rand = (seed: number): number => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
/** Nombre d'images par pas selon la vitesse (rapide = 1). */
const every = (speed: number, slow: number): number => Math.max(1, Math.round(slow - ((slow - 1) * speed) / 100));

export function previewFrame(c: Creation, frame: number, n = 40): Rgb[] {
  const colors = c.colors.length > 0 ? c.colors : [OFF];
  // Motif sur tout le ruban : montré LED par LED (l'éditeur passe `n` = nombre de LED du ruban).
  const full = c.style === 'motif' && colors.length * c.cell >= n;
  const cell = full ? c.cell : Math.max(1, Math.round(c.cell / 2));
  const pattern = colors.flatMap((col) => Array.from({ length: cell }, () => col));
  switch (c.style) {
    case 'motif':
    case 'step': {
      const step = Math.floor(frame / every(c.speed, c.style === 'step' || c.mode === 'flow' ? 10 : 3));
      if (c.style === 'motif' && c.mode === 'still') return Array.from({ length: n }, (_, i) => pattern[i % pattern.length]);
      if (c.style === 'motif' && c.mode === 'snake') {
        const snake = full ? snakeOf(pattern) : pattern;
        return Array.from({ length: n }, (_, i) => {
          const k = (((i - step) % n) + n) % n;
          return k < snake.length ? snake[k] : OFF;
        });
      }
      return Array.from({ length: n }, (_, i) => pattern[(((i - step) % pattern.length) + pattern.length) % pattern.length]);
    }
    case 'bands': {
      const width = { small: 4, medium: 7, large: 10 }[c.size];
      const pos = Math.floor(frame / every(c.speed, 4));
      return Array.from({ length: n }, (_, i) => {
        let out = c.bg;
        colors.forEach((col, b) => {
          const start = (pos + Math.round((b * n) / colors.length)) % n;
          const d = (((i - start) % n) + n) % n;
          if (d < width) {
            const edge = Math.min(d + 1, width - d) / Math.max(1, Math.ceil(width / 3));
            out = mix(out, col, Math.min(1, edge));
          }
        });
        return out;
      });
    }
    case 'glows': {
      const half = { small: 1, medium: 2, large: 4 }[c.size];
      const steps = every(c.speed, 14) * 2;
      const cycle = Math.floor(frame / (steps * 2));
      const phase = frame % (steps * 2);
      const k = phase < steps ? phase / steps : 2 - phase / steps;
      const center = half + Math.floor(rand(cycle + 1) * (n - 2 * half));
      const col = colors[cycle % colors.length];
      return Array.from({ length: n }, (_, i) => {
        const d = Math.abs(i - center);
        return d <= half ? mix(c.bg, col, k * (1 - d / (half + 1))) : c.bg;
      });
    }
    case 'flicker': {
      const bulbs = colors.flatMap((col) => [col, col, OFF]);
      const event = Math.floor(frame / 8);
      const slot = Math.floor(rand(event + 3) * Math.floor(n / 3));
      const blinking = frame % 8 < 4 && frame % 2 === 0;
      return Array.from({ length: n }, (_, i) =>
        blinking && Math.floor(i / 3) === slot ? OFF : bulbs[i % bulbs.length],
      );
    }
    case 'leaves': {
      const fall = 10;
      const leaf = Math.floor(frame / fall);
      const k = frame % fall;
      const start = Math.floor(rand(leaf + 7) * (n - fall));
      const col = colors[leaf % colors.length];
      return Array.from({ length: n }, (_, i) => (i === start + k ? mix(col, c.bg, k / fall) : c.bg));
    }
  }
}
