import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { lang } from '../i18n';
import { showDemoScan } from '../services/scan';
import { addRoom, getRooms, saveDevice } from '../services/store';
import { DEFAULTS, encodeCreation, toFullStrip } from '../core/creations';
import { rainbow } from '../core/motifTools';
import { kelvinToRgb } from '../core/white';
import { styles } from '../ui/kit';

/** Noms de démonstration (données de l'utilisateur, pas des textes de l'interface : pas de `t()`). */
const NAMES = {
  fr: { salon: 'Salon', chambre: 'Chambre', neon: 'Néon canapé', tv: 'Derrière la télé', ir: 'Néon 220 V', tuya: 'Ruban Wi-Fi', lit: 'Tête de lit', bureau: 'Bureau', wall: 'Néon mural', lamp: 'Lampe de chevet' },
  en: { salon: 'Living room', chambre: 'Bedroom', neon: 'Sofa neon', tv: 'Behind the TV', ir: 'Ceiling strip', tuya: 'Wi-Fi strip', lit: 'Headboard', bureau: 'Desk', wall: 'Wall neon', lamp: 'Bedside lamp' },
};

/**
 * Développement seulement : remplit l'appli de pièces et de rubans de démonstration (allumés, en couleur),
 * pour vérifier l'interface sur l'émulateur, qui n'a ni Bluetooth ni infrarouge, et faire les captures du store.
 * `ledstrip://dev-seed` ; `ledstrip://dev-seed?scan=1` ouvre aussi la recherche avec des résultats de démonstration.
 * Noms en français si le téléphone est en français, en anglais sinon.
 */
export default function DevSeed() {
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  useEffect(() => {
    if (!__DEV__) {
      router.replace('/');
      return;
    }
    void (async () => {
      const n = lang === 'fr' ? NAMES.fr : NAMES.en;
      const salon = getRooms().find((r) => r.name === n.salon) ?? (await addRoom(n.salon));
      const chambre = getRooms().find((r) => r.name === n.chambre) ?? (await addRoom(n.chambre));
      const now = Date.now();
      await saveDevice({ key: 'demo:neon', name: n.neon, family: 'elk-bledom', transport: 'ble', rawName: 'MELK-OA21   92', address: 'demo', roomId: salon.id, state: { on: true, rgb: { r: 255, g: 0, b: 140 }, brightness: 80 }, addedAt: now });
      await saveDevice({ key: 'demo:tv', name: n.tv, family: 'elk-bledom', transport: 'ble', rawName: 'ELK-BLEDOB', address: 'demo2', roomId: salon.id, state: { on: true, rgb: { r: 0, g: 200, b: 255 }, brightness: 70 }, addedAt: now + 1 });
      await saveDevice({ key: 'demo:ir', name: n.ir, family: 'ir-nec', transport: 'ir', rawName: 'Infrarouge', address: 'ir', ir: { power: { address: [0x00, 0xff], on: 0x07, off: 0x06 }, layout: 'full44' }, roomId: salon.id, state: { on: true, rgb: { r: 255, g: 128, b: 0 } }, addedAt: now + 2 });
      await saveDevice({ key: 'demo:lit', name: n.lit, family: 'wled', transport: 'wifi', rawName: 'WLED-Lit', address: '10.0.2.99', roomId: chambre.id, state: { on: true, rgb: { r: 140, g: 60, b: 255 }, brightness: 60 }, addedAt: now + 3 });
      await saveDevice({ key: 'demo:bureau', name: n.bureau, family: 'elk-bledom', transport: 'ble', rawName: 'ELK-BLE', address: 'demo4', roomId: chambre.id, state: { on: false, rgb: { r: 255, g: 220, b: 180 } }, addedAt: now + 4 });
      // Ruban à pixels (OpenBeken) en ambiance Aurore, avec une création dessinée pour l'éditeur ; ampoule Hue en Cocooning.
      const drawing = toFullStrip({ ...DEFAULTS, style: 'motif', mode: 'flow', cell: 1, colors: rainbow(42, 14) }, 84);
      await saveDevice({ key: 'demo:pixels', name: n.wall, family: 'openbeken', transport: 'wifi', rawName: 'obkDEMO', address: '10.0.2.98', roomId: salon.id, meta: { pixels: '84', length: '84', creation: encodeCreation(drawing) }, state: { on: true, brightness: 100, effect: 'obk-amb:aurora' }, addedAt: now + 6 });
      await saveDevice({ key: 'demo:lamp', name: n.lamp, family: 'hue', transport: 'wifi', rawName: n.lamp, address: '10.0.2.97', roomId: chambre.id, meta: { user: 'demo', light: '1', product: 'Hue color lamp', color: '1', ct: '1' }, state: { on: true, brightness: 75, kelvin: 2700, rgb: kelvinToRgb(2700) }, addedAt: now + 7 });
      await saveDevice({ key: 'demo:tuya', name: n.tuya, family: 'tuya', transport: 'wifi', rawName: 'Appareil Tuya', address: '192.168.1.78', addedAt: now + 5 });
      if (scan) {
        showDemoScan([
          { key: 'ble:BE:16:F8:22:0A:31', family: 'elk-bledom', confidence: 'sure', transport: 'ble', rawName: 'ELK-BLEDOM', address: 'BE:16:F8:22:0A:31', rssi: -58 },
          { key: 'wifi:yeelight:demo', family: 'yeelight', confidence: 'sure', transport: 'wifi', rawName: 'Yeelight', address: '192.168.1.33', model: 'color4' },
          { key: 'wifi:govee:demo', family: 'govee-lan', confidence: 'sure', transport: 'wifi', rawName: 'Govee H6159', address: '192.168.1.31', model: 'H6159' },
          { key: 'wifi:wled:demo', family: 'wled', confidence: 'sure', transport: 'wifi', rawName: 'WLED-Bureau', address: '192.168.1.40' },
          { key: 'hue-bridge:demo', family: 'hue-bridge', confidence: 'sure', transport: 'wifi', rawName: 'Philips Hue', address: '192.168.1.20', meta: { bridge: 'DEMO' } },
          { key: 'wifi:nanoleaf:demo', family: 'nanoleaf', confidence: 'sure', transport: 'wifi', rawName: 'Shapes 4A1B', address: '192.168.1.50', model: 'NL42' },
          { key: 'ble:FF:FF:10:4C:7E:02', family: 'sp110e', confidence: 'sure', transport: 'ble', rawName: 'SP110E', address: 'FF:FF:10:4C:7E:02', rssi: -74 },
          { key: 'wifi:192.168.1.78', family: 'tuya', confidence: 'probable', transport: 'wifi', rawName: 'Tuya 3.3', address: '192.168.1.78' },
        ]);
        router.replace('/');
        router.push('/add');
        return;
      }
      router.replace('/');
    })();
  }, [scan]);
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={styles.text}>Démo…</Text>
    </View>
  );
}
