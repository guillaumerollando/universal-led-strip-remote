import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { addRoom, getRooms, saveDevice } from '../services/store';
import { styles } from '../ui/kit';

/**
 * Développement seulement : remplit l'appli d'une pièce et de rubans de démonstration (allumés, en couleur),
 * pour vérifier l'interface sur l'émulateur, qui n'a ni Bluetooth ni infrarouge. `rubanix://dev-seed`
 */
export default function DevSeed() {
  useEffect(() => {
    if (!__DEV__) {
      router.replace('/');
      return;
    }
    void (async () => {
      const salon = getRooms().find((r) => r.name === 'Salon') ?? (await addRoom('Salon'));
      const now = Date.now();
      await saveDevice({ key: 'demo:neon', name: 'Néon canapé', family: 'elk-bledom', transport: 'ble', rawName: 'MELK-OA21   92', address: 'demo', roomId: salon.id, state: { on: true, rgb: { r: 255, g: 0, b: 140 } }, addedAt: now });
      await saveDevice({ key: 'demo:tv', name: 'Derrière la télé', family: 'elk-bledom', transport: 'ble', rawName: 'ELK-BLEDOB', address: 'demo2', roomId: salon.id, state: { on: true, rgb: { r: 0, g: 200, b: 255 } }, addedAt: now + 1 });
      await saveDevice({ key: 'demo:ir', name: 'Néon 220 V', family: 'ir-nec', transport: 'ir', rawName: 'Infrarouge', address: 'ir', ir: { power: { address: [0x00, 0xff], on: 0x07, off: 0x06 }, layout: 'full44' }, roomId: salon.id, state: { on: true, rgb: { r: 255, g: 128, b: 0 } }, addedAt: now + 2 });
      await saveDevice({ key: 'demo:tuya', name: 'Ruban Wi-Fi', family: 'tuya', transport: 'wifi', rawName: 'Appareil Tuya', address: '192.168.1.78', addedAt: now + 3 });
      router.replace('/');
    })();
  }, []);
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={styles.text}>Démo…</Text>
    </View>
  );
}
