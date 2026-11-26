import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useScan } from '../services/scan';
import { useRooms, useSavedDevices } from '../services/store';
import { Button, Muted, Screen, styles } from '../ui/kit';
import { SignatureStrip } from '../ui/light';
import { RoomSection } from '../ui/RoomSection';
import { colors, space } from '../ui/theme';
import { t } from '../i18n';

/** Accueil : les pièces et leurs rubans, à allumer en un geste. */
export default function HomeScreen() {
  const devices = useSavedDevices();
  const rooms = useRooms();
  const { found } = useScan();
  const nearby = new Set(found.map((d) => d.key));
  const loose = devices.filter((d) => !d.roomId || !rooms.some((r) => r.id === d.roomId));

  return (
    <Screen safeTop>
      <View style={{ marginBottom: space.sm }}>
        <SignatureStrip>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={[styles.big, { fontSize: 30 }]}>{t('Ruban LED')}</Text>
            <InfoButton />
          </View>
        </SignatureStrip>
      </View>

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
