/**
 * Widget « Pièces » (écran d'accueil Android) : l'appli lui pousse ses pièces et leur état à chaque changement.
 * Le widget ouvre `ledstrip://power?room=…` ; mêmes données prévues pour le widget iPhone (App Group).
 */
import native from '../../modules/rubanix-native/src';
import { widgetRooms } from '../core/widget';
import { canPower } from './control';
import { getDevices, getRooms, subscribeStore } from './store';
import { t } from '../i18n';

let timer: ReturnType<typeof setTimeout> | null = null;
let last = '';

function push(): void {
  const rooms = widgetRooms(getRooms(), getDevices().filter(canPower), {
    all: t('Tous les rubans'),
    on: (name) => t('{name} : éteindre', { name }),
    off: (name) => t('{name} : allumer', { name }),
  });
  const json = JSON.stringify(rooms);
  if (json === last) return;
  last = json;
  native?.setWidgetRooms(json, t('Ajouter un ruban'));
}

/** À appeler une fois au démarrage : le widget suit ensuite les pièces et les rubans. */
export function startWidgetSync(): void {
  if (!native) return;
  push();
  subscribeStore(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, 400);
  });
}
