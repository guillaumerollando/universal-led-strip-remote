import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useScan } from '../services/scan';
import { useRooms, useSavedDevices } from '../services/store';
import { Button, Muted, Screen, styles } from '../ui/kit';
import { SignatureStrip } from '../ui/light';
import { RoomSection } from '../ui/RoomSection';
import { space } from '../ui/theme';
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
        <Text style={[styles.big, { fontSize: 30 }]}>{t('Ruban LED')}</Text>
        <SignatureStrip />
      </View>

      {devices.length === 0 && rooms.length === 0 && (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <Text style={styles.title}>{t('Tous tes rubans, une seule appli.')}</Text>
          <Muted>
            {t(
              'L’appli trouve tes rubans Bluetooth et Wi-Fi, te dit de quelle appli ils viennent, et les pilote quand elle sait le faire. Les rubans à télécommande infrarouge aussi, si ton téléphone a un émetteur.',
            )}
          </Muted>
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
