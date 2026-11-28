/**
 * Widget « Pièces » (écran d'accueil Android) : l'appli lui pousse ses pièces et leur état à chaque changement.
 * Le widget ouvre `ledstrip://power?room=…` ; mêmes données prévues pour le widget iPhone (App Group).
 */
import native from '../../modules/led-strip-native/src';
import { decodeMotif } from '../core/protocols/openbeken';
import type { Rgb } from '../core/protocols/types';
import { BUILTIN_AMBIANCES } from '../core/ambiances';
import { widgetPlaces, widgetRooms } from '../core/widget';
import { canPower } from './control';
import { favoritesFirst, getFavorites, sceneFav, subscribeFavorites } from './favorites';
import { allScenes, presetsOf, subscribeScenes } from './scenes';
import { getDevices, getRooms, subscribeStore } from './store';
import { t } from '../i18n';

let timer: ReturnType<typeof setTimeout> | null = null;
let last = '';

function push(): void {
  const labels = {
    all: t('Toutes les lumières'),
    on: (name: string) => t('{name} : éteindre', { name }),
    off: (name: string) => t('{name} : allumer', { name }),
  };
  const devices = getDevices().filter(canPower);
  const rooms = widgetRooms(getRooms(), devices, labels);
  const places = widgetPlaces(getRooms(), devices, scenesOf, labels);
  const json = JSON.stringify(rooms);
  const placesJson = JSON.stringify(places);
  if (json + placesJson === last) return;
  last = json + placesJson;
  native?.setWidgetRooms(json, t('Ajouter une lumière'));
  native?.setWidgetPlaces?.(placesJson, t('Ajoute-le depuis l’appli : appui long sur une pièce ou une ambiance.'));
}

const RAINBOW: Rgb[] = [
  { r: 255, g: 0, b: 0 },
  { r: 255, g: 160, b: 0 },
  { r: 0, g: 220, b: 0 },
  { r: 0, g: 120, b: 255 },
  { r: 200, g: 0, b: 255 },
];

/** Les ambiances d'une pièce pour les widgets : celles de l'appli puis celles retenues, avec leurs couleurs. */
function scenesOf(roomId: string): { id: string; name: string; colors: Rgb[] }[] {
  const presets = presetsOf(roomId).map((p) => ({
    id: p.id,
    name: t(p.name),
    colors: BUILTIN_AMBIANCES.find((a) => a.id === p.ambiance)?.colors ?? (p.effects ? RAINBOW : [p.rgb]),
  }));
  const mine = allScenes()
    .filter((s) => s.roomId === roomId)
    .map((s) => ({
      id: s.id,
      name: s.name,
      colors: s.items.filter((i) => i.on).flatMap((i) => decodeMotif(i.motif)?.pixels ?? (i.rgb ? [i.rgb] : [])),
    }));
  // Les favorites d'abord : le widget « Pièce » montre les trois premières.
  return favoritesFirst([...mine, ...presets], (x) => sceneFav(x.id), getFavorites());
}

/** À appeler une fois au démarrage : le widget suit ensuite les pièces et les rubans. */
export function startWidgetSync(): void {
  if (!native) return;
  push();
  const later = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, 400);
  };
  subscribeStore(later);
  subscribeScenes(later);
  subscribeFavorites(later);
}
