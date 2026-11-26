import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { canPower, setGroupPower } from '../services/control';
import { markLongPressSeen, useLongPressHint } from '../services/hints';
import { useScan } from '../services/scan';
import { useRooms, useSavedDevices } from '../services/store';
import { Button, Muted, Screen, styles } from '../ui/kit';
import { PowerButton, SignatureStrip } from '../ui/light';
import { RoomSection } from '../ui/RoomSection';
import { colors, radius, space } from '../ui/theme';
import { t } from '../i18n';

/** Accueil : les pièces et leurs rubans, à allumer en un geste (toucher = agir, appui long = réglages). */
export default function HomeScreen() {
  const devices = useSavedDevices();
  const rooms = useRooms();
  const { found } = useScan();
  const nearby = new Set(found.map((d) => d.key));
  const loose = devices.filter((d) => !d.roomId || !rooms.some((r) => r.id === d.roomId));
  const hint = useLongPressHint();
  const controllable = devices.filter(canPower);
  const allOn = controllable.some((d) => d.state?.on);
  const [busy, setBusy] = useState(false);
  /** Interrupteur général : tout éteindre si un ruban brille, sinon tout allumer. */
  const toggleAll = (): void => {
    setBusy(true);
    void setGroupPower(controllable, !allOn).finally(() => setBusy(false));
  };

  return (
    <Screen safeTop>
      <View style={{ marginBottom: space.sm }}>
        <SignatureStrip>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={[styles.big, { fontSize: 30, flex: 1 }]} numberOfLines={1}>
              {t('Ruban LED')}
            </Text>
            {controllable.length > 1 && (
              <PowerButton
                on={allOn}
                onPress={toggleAll}
                busy={busy}
                size={38}
                label={t(allOn ? '{name} : éteindre' : '{name} : allumer', { name: t('Tous les rubans') })}
              />
            )}
            <InfoButton />
          </View>
        </SignatureStrip>
      </View>

      {hint && devices.length > 0 && (
        <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, marginTop: space.sm }]}>
          <Text style={[styles.muted, { flex: 1 }]}>{t('Astuce : appui long sur une pièce ou un ruban pour ses réglages.')}</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={markLongPressSeen}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('Compris')}</Text>
          </Pressable>
        </View>
      )}

      {devices.length === 0 && rooms.length === 0 && (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <Text style={styles.title}>{t('Tous tes rubans, une seule appli.')}</Text>
          <Muted>{t('Bluetooth, Wi-Fi ou télécommande : ajoute ton premier ruban.')}</Muted>
        </View>
      )}

      {rooms.map((room) => (
        <RoomSection key={room.id} room={room} devices={devices.filter((d) => d.roomId === room.id)} nearbyKeys={nearby} />
      ))}
      {loose.length > 0 && <RoomSection room={null} devices={loose} nearbyKeys={nearby} />}

      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Button label={t('Ajouter un ruban')} onPress={() => router.push('/add')} />
        <Button label={t('Nouvelle pièce')} variant="secondary" onPress={() => router.push({ pathname: '/room/[id]', params: { id: 'new' } })} />
      </View>
    </Screen>
  );
}

/** Petit ⓘ discret : ouvre « À propos ». */
function InfoButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('À propos')} hitSlop={14} onPress={() => router.push('/about')} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.textDim, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textDim, fontSize: 14, fontWeight: '700', lineHeight: 16 }}>i</Text>
      </View>
    </Pressable>
  );
}
