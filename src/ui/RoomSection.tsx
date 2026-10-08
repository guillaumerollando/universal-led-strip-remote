import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Rgb } from '../core/elk';
import { canPower, setGroupPower } from '../services/control';
import type { Room, SavedDevice } from '../services/store';
import { DeviceTile } from './DeviceTile';
import { styles as kit } from './kit';
import { Glow } from './light';
import { colors, radius, space, WARM_WHITE } from './theme';
import { t } from '../i18n';

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

/** Une pièce : son nom, combien de rubans brillent, et tout allumer / tout éteindre en un geste. */
export function RoomSection({ room, devices, nearbyKeys }: { room: Room | null; devices: SavedDevice[]; nearbyKeys: Set<string> }) {
  const [busy, setBusy] = useState<'on' | 'off' | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const controllable = devices.filter(canPower);
  const litCount = devices.filter((d) => d.state?.on).length;
  const tint = roomTint(devices);

  const all = (on: boolean): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(on ? 'on' : 'off');
    setReport(null);
    setGroupPower(controllable, on)
      .then((r) => {
        if (r.failed.length > 0) {
          const names = r.failed.map((f) => devices.find((d) => d.key === f.key)?.name ?? f.key);
          setReport(t('Pas de réponse : {names}', { names: names.join(', ') }));
        }
      })
      .finally(() => setBusy(null));
  };

  return (
    <View style={{ gap: space.sm, marginTop: space.lg }}>
      <View style={{ borderRadius: radius.lg, overflow: 'hidden', padding: space.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: space.md }}>
        {tint && <Glow rgb={tint} intensity={0.35} style={{ top: -60, left: -40, right: -40, bottom: -20 }} />}
        <Pressable
          disabled={!room}
          onPress={() => room && router.push({ pathname: '/room/[id]', params: { id: room.id } })}
          style={kit.row}
        >
          <View style={{ flex: 1 }}>
            <Text style={kit.big}>{room?.name ?? t('Sans pièce')}</Text>
            <Text style={kit.muted}>
              {devices.length === 0
                ? t('Aucun ruban pour l’instant')
                : t(litCount > 1 ? '{lit} allumés sur {total}' : '{lit} allumé sur {total}', { lit: litCount, total: devices.length })}
            </Text>
          </View>
          {room && <Text style={[kit.muted, { color: colors.accent }]}>{t('Modifier')}</Text>}
        </Pressable>
        {room && controllable.length > 0 && (
          <View style={kit.row}>
            <GroupButton label={t('Tout allumer')} lit onPress={() => all(true)} busy={busy === 'on'} disabled={!!busy} />
            <GroupButton label={t('Tout éteindre')} onPress={() => all(false)} busy={busy === 'off'} disabled={!!busy} />
          </View>
        )}
        {report && <Text style={[kit.muted, { color: colors.danger }]}>{report}</Text>}
      </View>
      {devices.map((d) => (
        <DeviceTile key={d.key} device={d} nearby={nearbyKeys.has(d.key)} />
      ))}
    </View>
  );
}

function GroupButton({ label, lit, onPress, busy, disabled }: { label: string; lit?: boolean; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 46,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: lit ? colors.accent : colors.surfaceHigh,
        borderWidth: 1,
        borderColor: lit ? colors.accent : colors.border,
        opacity: pressed || (disabled && !busy) ? 0.6 : 1,
      })}
    >
      <Text style={{ fontWeight: '700', color: lit ? colors.accentText : colors.text }}>{busy ? '…' : label}</Text>
    </Pressable>
  );
}
