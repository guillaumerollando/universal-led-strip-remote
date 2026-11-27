import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CALIBRATION_HUE_MAX, estimateLength } from '../../core/calibration';
import { hsvToRgb } from '../../core/color';
import { latestWins, setStripLength, showCalibration, stripLength } from '../../services/control';
import { useSavedDevice } from '../../services/store';
import { Button, Muted, Screen, SectionTitle, styles } from '../../ui/kit';
import { Chip } from '../../ui/light';
import { colors, radius, rgbCss } from '../../ui/theme';
import { t } from '../../i18n';

/** Les couleurs de la barre : les mêmes que l'arc-en-ciel allumé sur le ruban (rouge → violet). */
const STOPS = Array.from({ length: 6 }, (_, i) => rgbCss(hsvToRgb({ h: (CALIBRATION_HUE_MAX * i) / 5, s: 1, v: 1 })));

/**
 * Aide au calibrage (« le dessin ne correspond pas au ruban ? ») : 1. le ruban s'allume en arc-en-ciel, on touche la
 * couleur vue au bout ; 2. la dernière LED s'allume en blanc, on ajuste jusqu'à ce qu'elle soit tout au bout.
 */
export default function CalibrateScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const device = useSavedDevice(key);
  const [step, setStep] = useState<'color' | 'fine'>('color');
  const [length, setLength] = useState(() => (device ? stripLength(device) : 100));
  const [width, setWidth] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (p: Promise<void>): void => {
    setBusy(true);
    p.then(() => setError(null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  const sendLength = useMemo(
    () =>
      latestWins((len: number) =>
        device ? setStripLength(device, len).then(() => setError(null), (e: Error) => setError(e.message)) : Promise.resolve(),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [device?.key],
  );
  // L'arc-en-ciel s'allume à l'ouverture (et à « Recommencer »).
  useEffect(() => {
    if (device && step === 'color') run(showCalibration(device));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!device) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Muted>{t('Cet appareil n’est plus dans la liste. Relance une recherche.')}</Muted>
      </View>
    );
  }
  const configured = Number(device.meta?.pixels) || 100;
  /** Plusieurs appuis rapides : seule la dernière longueur part au ruban ; « C'est bon » attend qu'elle soit arrivée. */
  const apply = (next: number): void => {
    const len = Math.max(1, Math.min(configured, next));
    setLength(len);
    setBusy(true);
    sendLength(len);
    void sendLength.idle(false).then(() => setBusy(false));
  };

  return (
    <Screen>
      {step === 'color' ? (
        <>
          <SectionTitle>{t('1. La couleur du bout')}</SectionTitle>
          <Text style={styles.text}>{t('Ton ruban s’allume en arc-en-ciel. Touche ici la couleur que tu vois tout au bout du ruban.')}</Text>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel={t('Couleur du bout du ruban')}
            disabled={busy}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            onPress={(e) => {
              void Haptics.selectionAsync();
              apply(estimateLength(e.nativeEvent.locationX / width, configured));
              setStep('fine');
            }}
            style={{ height: 64, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, opacity: busy ? 0.5 : 1 }}
          >
            <LinearGradient pointerEvents="none" colors={STOPS as [string, string, ...string[]]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Pressable>
          <Muted>{t('Tout l’arc-en-ciel jusqu’au violet ? Ton ruban est déjà bien réglé.')}</Muted>
        </>
      ) : (
        <>
          <SectionTitle>{t('2. La dernière LED')}</SectionTitle>
          <Text style={styles.text}>{t('La dernière LED est allumée en blanc. Ajuste jusqu’à ce qu’elle soit tout au bout du ruban.')}</Text>
          <Text style={[styles.text, { fontSize: 22, fontWeight: '700', textAlign: 'center' }]}>{t('Longueur du ruban : {n} LED', { n: length })}</Text>
          <View style={[styles.row, { justifyContent: 'center' }]}>
            {[-10, -1, 1, 10].map((d) => (
              <Chip key={d} label={d > 0 ? `+${d}` : `−${-d}`} disabled={d < 0 ? length <= 1 : length >= configured} onPress={() => apply(length + d)} />
            ))}
          </View>
          <Button label={t('C’est bon')} onPress={() => router.back()} busy={busy} />
          <Button label={t('Recommencer')} variant="ghost" onPress={() => setStep('color')} />
        </>
      )}
      {error && <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text>}
    </Screen>
  );
}
