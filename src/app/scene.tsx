import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import native from '../../modules/led-strip-native/src';
import { applyScene, findScene, markApplied, presetItems } from '../services/scenes';
import { getDevices, getRooms, loadDevices } from '../services/store';
import { styles } from '../ui/kit';
import { space } from '../ui/theme';
import { t } from '../i18n';

/**
 * Lien d'une ambiance de pièce (widgets) : `ledstrip://scene?room=<id>&scene=<id>&from=widget`.
 * Règle tous les rubans de la pièce, puis rend la main à l'écran d'accueil si on vient d'un widget.
 */
export default function SceneLink() {
  const { room, scene, from } = useLocalSearchParams<{ room?: string; scene?: string; from?: string }>();
  const [text, setText] = useState('…');

  useEffect(() => {
    let done = false;
    let leave: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      await loadDevices();
      const found = scene ? await findScene(scene) : undefined;
      const target = getRooms().find((r) => r.id === room);
      if (done) return;
      if (!found || !target) {
        setText(t('Cette ambiance n’existe plus.'));
      } else {
        const devices = getDevices().filter((d) => d.roomId === target.id);
        const items = 'items' in found ? found.items : presetItems(found, devices);
        const name = 'mine' in found && found.mine ? found.name : t(found.name);
        setText(t('{scene} · {room}', { scene: name, room: target.name }));
        const result = await applyScene(items);
        if (result.failed.length < items.length && scene) markApplied(target.id, scene, devices.map((d) => d.key));
        if (result.failed.length) setText(t('{scene} · {room}', { scene: name, room: target.name }) + t(' ({n} sans réponse)', { n: result.failed.length }));
      }
      // Écran quitté entre-temps : on ne renvoie pas à l'accueil.
      if (done) return;
      leave = setTimeout(() => {
        router.replace('/');
        if (from === 'widget') native?.moveToBack();
      }, from === 'widget' ? 500 : 1200);
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
