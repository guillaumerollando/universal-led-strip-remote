import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import native from '../../modules/rubanix-native/src';
import { setGroupPower } from '../services/control';
import { getDevices, getRooms, loadDevices } from '../services/store';
import { styles } from '../ui/kit';
import { space } from '../ui/theme';
import { t } from '../i18n';

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Lien profond pour les raccourcis et les assistants :
 * `ledstrip://power?room=Salon&on=1`, `ledstrip://power?device=<nom>&on=0`, `ledstrip://power?all=1&on=0`.
 */
export default function PowerLink() {
  const { room, device, all, on, from } = useLocalSearchParams<{ room?: string; device?: string; all?: string; on?: string; from?: string }>();
  const [text, setText] = useState('…');

  useEffect(() => {
    let done = false;
    let leave: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      await loadDevices();
      if (done) return;
      const rooms = getRooms();
      const devices = getDevices();
      const wantOn = on !== '0' && on !== 'false';
      const matchedRoom = room ? rooms.find((r) => norm(r.name) === norm(room) || r.id === room) : undefined;
      const targets = all
        ? devices
        : matchedRoom
          ? devices.filter((d) => d.roomId === matchedRoom.id)
          : devices.filter((d) => device && (norm(d.name) === norm(device) || d.key === device));
      const label = all ? t('Tous les rubans') : (matchedRoom?.name ?? device ?? '?');
      if (targets.length === 0) {
        setText(t('Rien trouvé pour « {label} »', { label }));
      } else {
        const result = await setGroupPower(targets, wantOn);
        setText(
          t(wantOn ? '{label} : allumé' : '{label} : éteint', { label }) +
            (result.failed.length ? t(' ({n} sans réponse)', { n: result.failed.length }) : ''),
        );
      }
      // Écran quitté entre-temps : on ne renvoie pas à l'accueil.
      if (done) return;
      leave = setTimeout(() => {
        router.replace('/');
        // Lancé depuis le widget : on rend la main à l'écran d'accueil du téléphone.
        if (from === 'widget') native?.moveToBack();
      }, from === 'widget' ? 700 : 1200);
    })();
    return () => {
      done = true;
      if (leave) clearTimeout(leave);
    };
    // Une seule exécution par ouverture du lien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: space.xl }]}>
      <Text style={[styles.big, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}
