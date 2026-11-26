import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { setPower } from '../../services/control';
import { foundDevice } from '../../services/scan';
import { saveDevice } from '../../services/store';
import { AddForm } from '../../ui/AddForm';
import { Button, Muted, styles } from '../../ui/kit';
import { defaultStripName, kindLabel, signalText } from '../../ui/labels';
import { LedRow } from '../../ui/LedRow';
import { colors, radius, space, WARM_WHITE } from '../../ui/theme';
import { t } from '../../i18n';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Ajout d'un ruban trouvé par la recherche : un nom (déjà proposé), une pièce, « Ajouter à mes rubans ».
 * Un petit test « le faire clignoter » aide à reconnaître le bon ruban. Couleurs et effets : sur sa fiche, après.
 */
export default function NewDeviceScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const device = key ? foundDevice(key) : undefined;
  const [name, setName] = useState(defaultStripName);
  const [roomId, setRoomId] = useState<string | undefined>();
  const [blinking, setBlinking] = useState(false);
  const [blinked, setBlinked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  if (!device) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Muted>{t('Cet appareil n’est plus dans la liste. Relance une recherche.')}</Muted>
        <Button label={t('Retour')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  /** Éteint puis rallume deux fois : on voit tout de suite quel ruban on ajoute. */
  const blink = async (): Promise<void> => {
    setBlinking(true);
    setError(null);
    try {
      for (const on of [false, true, false, true]) {
        await setPower(device, on);
        await sleep(450);
        if (!alive.current) return;
      }
      setBlinked(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (alive.current) setError(t('Pas de réponse : rapproche-toi du ruban.'));
    } finally {
      if (alive.current) setBlinking(false);
    }
  };

  const save = (): void => {
    if (!name.trim()) return;
    void saveDevice({
      key: device.key,
      name: name.trim(),
      family: device.family,
      transport: device.transport,
      rawName: device.rawName,
      address: device.address,
      model: device.model,
      roomId,
      state: blinked ? { on: true } : undefined,
      addedAt: Date.now(),
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
  };

  const signal = signalText(device.rssi);

  return (
    <AddForm
      name={name}
      onName={setName}
      roomId={roomId}
      onRoom={setRoomId}
      onSave={save}
      top={
        <View style={{ gap: space.sm }}>
          <LedRow mode={blinking ? 'chase' : 'lit'} rgb={WARM_WHITE} count={9} size={18} />
          <Text style={[styles.big, { textAlign: 'center' }]}>{t('C’est trouvé !')}</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            {kindLabel(device.transport)}
            {signal ? ` · ${signal}` : ''}
          </Text>
          <View style={[styles.row, { justifyContent: 'center', marginTop: space.xs }]}>
            <Text style={styles.muted}>{t('C’est bien lui ?')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void blink()}
              disabled={blinking}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingHorizontal: space.md,
                paddingVertical: 6,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed || blinking ? 0.6 : 1,
              })}
            >
              <Text style={{ color: colors.accent, fontWeight: '600' }}>{blinking ? '…' : t('Faire clignoter')}</Text>
            </Pressable>
          </View>
          {error && <Text style={[styles.muted, { color: colors.warn, textAlign: 'center' }]}>{error}</Text>}
        </View>
      }
    />
  );
}
