import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ownName, productName, stripKind } from '../../core/describe';
import { FAMILIES } from '../../core/families';
import { canPower, setPower } from '../../services/control';
import { pairHue, pairNanoleaf } from '../../services/pairing';
import { putFound, useScan } from '../../services/scan';
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
  const { found } = useScan();
  const device = found.find((d) => d.key === key);
  // Un appareil Wi-Fi de marque a souvent déjà un nom donné par son propriétaire (« Télé » sur le pont Hue) : on le garde.
  const [name, setName] = useState(() => (device?.transport === 'wifi' && FAMILIES[device.family].brand && ownName(device)) || defaultStripName());
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
      meta: device.meta,
      roomId,
      state: blinked ? { on: true } : undefined,
      addedAt: Date.now(),
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
  };

  const signal = signalText(device.rssi);
  const family = FAMILIES[device.family];
  const kind = stripKind(device);
  const product = productName(device) ?? (kind ? t(kind) : kindLabel(device.transport));
  if (family.pairing && !canPower(device)) return <PairStep device={device} product={product} />;

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
            {product}
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

/**
 * Pont Hue ou Nanoleaf : on presse un bouton sur l'appareil, puis « Relier ». L'appli reçoit une clé locale
 * (pas de compte). Pont Hue : ses lampes apparaissent ensuite dans la recherche, à ajouter une par une.
 */
function PairStep({ device, product }: { device: NonNullable<ReturnType<typeof useScan>['found'][number]>; product: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hue = device.family === 'hue-bridge';

  const pair = (): void => {
    setBusy(true);
    setError(null);
    (hue ? pairHue(device) : pairNanoleaf(device))
      .then((res) => {
        if (!res.ok) return setError(res.needButton ? t('Bouton pas encore pressé : réessaie.') : t('Pas de réponse : vérifie qu’il est allumé et sur le même Wi-Fi.'));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        putFound(res.devices);
        // Pont : retour à la liste où ses lampes sont apparues. Nanoleaf : l'écran d'ajout s'affiche tout seul.
        if (hue) router.back();
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <View style={[styles.screen, styles.content, { justifyContent: 'center' }]}>
      <LedRow mode={busy ? 'chase' : 'lit'} rgb={WARM_WHITE} count={9} size={18} />
      <Text style={[styles.big, { textAlign: 'center' }]}>{product}</Text>
      <Text style={[styles.text, { textAlign: 'center' }]}>
        {hue ? t('Appuie sur le bouton rond du pont, puis touche « Relier ».') : t('Tiens le bouton marche 5 secondes, puis touche « Relier ».')}
      </Text>
      <Button label={t('Relier')} onPress={pair} busy={busy} />
      {error && <Text style={[styles.muted, { color: colors.warn, textAlign: 'center' }]}>{error}</Text>}
      <Button label={t('Retour')} variant="ghost" onPress={() => router.back()} />
    </View>
  );
}
