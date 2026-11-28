import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Rgb } from '../core/elk';
import { canPower, setGroupPower } from '../services/control';
import { markLongPressSeen } from '../services/hints';
import { pinWidget } from '../services/pinWidget';
import { removeRoom, renameRoom, roomNamed, type Room, type SavedDevice } from '../services/store';
import { DeviceTile } from './DeviceTile';
import { styles as kit } from './kit';
import { Glow, PowerButton } from './light';
import { SceneRow } from './SceneRow';
import { RenameField, Sheet } from './Sheet';
import { colors, radius, space, WARM_WHITE } from './theme';
import { t } from '../i18n';
import { showDialog } from './Dialog';

/** Couleur de l'interrupteur d'une pièce : le filament chaud de l'interface (`colors.accent`). */
const ACCENT: Rgb = { r: 255, g: 181, b: 71 };

/** Moyenne des couleurs des rubans allumés : la « teinte » de la pièce. */
function roomTint(devices: SavedDevice[]): Rgb | null {
  const lit = devices.filter((d) => d.state?.on);
  if (lit.length === 0) return null;
  const sum = lit.reduce(
    (acc, d) => {
      const c = d.state?.rgb ?? WARM_WHITE;
      return { r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b };
    },
    { r: 0, g: 0, b: 0 },
  );
  return { r: sum.r / lit.length, g: sum.g / lit.length, b: sum.b / lit.length };
}

/**
 * Une pièce : son nom, combien de rubans brillent, et un seul interrupteur pour toute la pièce.
 * Toucher = tout allumer / tout éteindre ; appui long = ses réglages (renommer, ses rubans, supprimer).
 */
export function RoomSection({ room, devices, nearbyKeys }: { room: Room | null; devices: SavedDevice[]; nearbyKeys: Set<string> }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [menu, setMenu] = useState<'menu' | 'rename' | null>(null);
  const controllable = devices.filter(canPower);
  const litCount = devices.filter((d) => d.state?.on).length;
  const tint = roomTint(devices);
  const on = controllable.some((d) => d.state?.on);
  const name = room?.name ?? t('Sans pièce');

  const toggle = (): void => {
    if (controllable.length === 0 || busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    setReport(null);
    setGroupPower(controllable, !on)
      .then((r) => {
        if (r.failed.length > 0) {
          const names = r.failed.map((f) => devices.find((d) => d.key === f.key)?.name ?? f.key);
          setReport(t('Pas de réponse : {names}', { names: names.join(', ') }));
        }
      })
      .finally(() => setBusy(false));
  };

  const remove = (): void => {
    setMenu(null);
    if (!room) return;
    showDialog(t('Supprimer « {name} » ?', { name: room.name }), t('Les lumières restent, elles passent dans « Sans pièce ».'), [
      { text: t('Annuler'), style: 'cancel' },
      { text: t('Supprimer'), style: 'destructive', onPress: () => void removeRoom(room.id) },
    ]);
  };

  return (
    <View style={{ gap: space.sm, marginTop: space.lg }}>
      <Pressable
        onPress={toggle}
        onLongPress={
          room
            ? () => {
                markLongPressSeen();
                setMenu('menu');
              }
            : undefined
        }
        accessibilityRole={controllable.length > 0 ? 'switch' : 'button'}
        accessibilityState={controllable.length > 0 ? { checked: on, busy } : undefined}
        accessibilityLabel={name}
        accessibilityHint={room ? t('Appui long : réglages') : undefined}
        style={({ pressed }) => ({
          borderRadius: radius.lg,
          overflow: 'hidden',
          padding: space.lg,
          backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          gap: space.sm,
        })}
      >
        {tint && <Glow rgb={tint} intensity={0.35} style={{ top: -60, left: -40, right: -40, bottom: -20 }} />}
        <View style={kit.row}>
          <View style={{ flex: 1 }}>
            <Text style={kit.big}>{name}</Text>
            <Text style={kit.muted}>
              {devices.length === 0
                ? t('Aucune lumière pour l’instant')
                : t(litCount > 1 ? '{lit} allumés sur {total}' : '{lit} allumé sur {total}', { lit: litCount, total: devices.length })}
            </Text>
          </View>
          {controllable.length > 0 && (
            <PowerButton on={on} rgb={ACCENT} onPress={toggle} busy={busy} size={56} label={t(on ? '{name} : éteindre' : '{name} : allumer', { name })} />
          )}
        </View>
        {report && <Text style={[kit.muted, { color: colors.danger }]}>{report}</Text>}
      </Pressable>
      {room && <SceneRow room={room} devices={devices} />}
      {devices.map((d) => (
        <DeviceTile key={d.key} device={d} nearby={nearbyKeys.has(d.key)} />
      ))}
      {room && (
        <Sheet
          visible={menu !== null}
          title={room.name}
          onClose={() => setMenu(null)}
          items={[
            { label: t('Renommer'), onPress: () => setMenu('rename') },
            {
              label: t('Lumières de la pièce'),
              onPress: () => {
                setMenu(null);
                router.push({ pathname: '/room/[id]', params: { id: room.id } });
              },
            },
            {
              label: t('Ajouter à l’écran d’accueil'),
              onPress: () => {
                setMenu(null);
                pinWidget('room', room.id);
              },
            },
            { label: t('Supprimer la pièce'), onPress: remove, danger: true },
          ]}
        >
          {menu === 'rename' ? (
            <RenameField
              initial={room.name}
              taken={(n) => !!roomNamed(n, room.id)}
              onDone={(n) => {
                void renameRoom(room.id, n);
                setMenu(null);
              }}
            />
          ) : undefined}
        </Sheet>
      )}
    </View>
  );
}
