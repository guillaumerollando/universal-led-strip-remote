/** Ce que montre le widget « Pièces » : jusqu'à 4 pièces qui ont un ruban pilotable, ou « Tous les rubans ». */

export interface WidgetRoom {
  name: string;
  on: boolean;
  /** Lien sans `on=` : le widget ajoute l'inverse de l'état connu. */
  link: string;
  /** Ce que TalkBack annonce : « Salon : éteindre ». */
  label: string;
}

interface Labels {
  all: string;
  on: (name: string) => string;
  off: (name: string) => string;
}

export function widgetRooms(
  rooms: { id: string; name: string }[],
  devices: { roomId?: string; state?: { on?: boolean } }[],
  labels: Labels,
): WidgetRoom[] {
  const make = (name: string, link: string, members: typeof devices): WidgetRoom => {
    const on = members.some((d) => d.state?.on);
    return { name, on, link, label: on ? labels.on(name) : labels.off(name) };
  };
  const withStrips = rooms
    .map((r) => ({ r, members: devices.filter((d) => d.roomId === r.id) }))
    .filter((x) => x.members.length > 0)
    .slice(0, 4)
    .map(({ r, members }) => make(r.name, `ledstrip://power?room=${encodeURIComponent(r.id)}`, members));
  if (withStrips.length > 0) return withStrips;
  return devices.length > 0 ? [make(labels.all, 'ledstrip://power?all=1', devices)] : [];
}

/** Une ambiance de pièce telle que la montrent les widgets : son nom, son lien et ses couleurs (dégradé du bouton). */
export interface WidgetScene {
  id: string;
  name: string;
  link: string;
  /** Couleurs `#rrggbb`, au moins une. */
  colors: string[];
}

/** Une pièce pour les widgets « Pièce » et « Ambiance » (posés depuis l'appli, une pièce ou une ambiance chacun). */
export interface WidgetPlace {
  id: string;
  name: string;
  on: boolean;
  /** Lien marche/arrêt sans `on=` (le widget ajoute l'inverse de l'état connu). */
  link: string;
  label: string;
  scenes: WidgetScene[];
}

const hex = ({ r, g, b }: { r: number; g: number; b: number }): string =>
  `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** Les couleurs d'une ambiance : celles de ses rubans allumés (couleur ou motif), sans doublon ni noir. */
export function sceneColors(colors: { r: number; g: number; b: number }[]): string[] {
  const list = [...new Set(colors.filter((c) => c.r + c.g + c.b >= 60).map(hex))].slice(0, 6);
  return list.length > 0 ? list : ['#ffb547'];
}

export function widgetPlaces(
  rooms: { id: string; name: string }[],
  devices: { roomId?: string; state?: { on?: boolean } }[],
  scenesOf: (roomId: string) => { id: string; name: string; colors: { r: number; g: number; b: number }[] }[],
  labels: Labels,
): WidgetPlace[] {
  return rooms
    .map((r) => ({ r, members: devices.filter((d) => d.roomId === r.id) }))
    .filter((x) => x.members.length > 0)
    .map(({ r, members }) => {
      const on = members.some((d) => d.state?.on);
      const room = encodeURIComponent(r.id);
      return {
        id: r.id,
        name: r.name,
        on,
        link: `ledstrip://power?room=${room}`,
        label: on ? labels.on(r.name) : labels.off(r.name),
        scenes: scenesOf(r.id).map((s) => ({
          id: s.id,
          name: s.name,
          link: `ledstrip://scene?room=${room}&scene=${encodeURIComponent(s.id)}`,
          colors: sceneColors(s.colors),
        })),
      };
    });
}
