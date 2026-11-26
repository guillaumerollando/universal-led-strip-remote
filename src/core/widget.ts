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
