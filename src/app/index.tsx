import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { canPower, setGroupPower } from '../services/control';
import { markLongPressSeen, useLongPressHint } from '../services/hints';
import { useScan } from '../services/scan';
import { useRooms, useSavedDevices } from '../services/store';
import { Button, Muted, Screen, styles } from '../ui/kit';
import { Glow, PowerButton, SignatureStrip } from '../ui/light';
import { LedRow } from '../ui/LedRow';
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
                size={30}
                quiet
                label={t(allOn ? '{name} : éteindre' : '{name} : allumer', { name: t('Toutes les lumières') })}
              />
            )}
            <InfoButton />
          </View>
        </SignatureStrip>
      </View>

      {hint && devices.length > 0 && (
        <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, marginTop: space.sm }]}>
          <Text style={[styles.muted, { flex: 1 }]}>{t('Astuce : appui long sur une pièce ou une lumière pour ses réglages.')}</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={markLongPressSeen}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('Compris')}</Text>
          </Pressable>
        </View>
      )}

      {devices.length === 0 && <EmptyHome />}

      {rooms.map((room) => (
        <RoomSection key={room.id} room={room} devices={devices.filter((d) => d.roomId === room.id)} nearbyKeys={nearby} />
      ))}
      {loose.length > 0 && <RoomSection room={null} devices={loose} nearbyKeys={nearby} />}

      {devices.length > 0 && (
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          <Button label={t('Ajouter une lumière')} onPress={() => router.push('/add')} />
          <Button label={t('Nouvelle pièce')} variant="secondary" onPress={() => router.push({ pathname: '/room/[id]', params: { id: 'new' } })} />
        </View>
      )}
    </Screen>
  );
}

/**
 * Premier lancement : un ruban qui attend d'être allumé, et un gros bouton « + » à hauteur de pouce
 * (bas de l'écran). Les pièces viendront pendant l'ajout : pas de « Nouvelle pièce » ici.
 */
function EmptyHome() {
  const { height } = useWindowDimensions();
  return (
    <View style={{ minHeight: height * 0.68, justifyContent: 'space-between', alignItems: 'center', paddingTop: space.xl }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <LedRow mode="chase" count={11} size={14} />
        <Text style={[styles.big, { fontSize: 26, textAlign: 'center' }]}>{t('Tous tes rubans et ampoules, une seule appli.')}</Text>
        <Muted>{t('Bluetooth, Wi-Fi ou télécommande : ajoute ton premier ruban ou ta première ampoule.')}</Muted>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Ajouter ma première lumière')}
        onPress={() => router.push('/add')}
        style={({ pressed }) => ({ alignItems: 'center', gap: space.md, opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
      >
        <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Glow rgb={{ r: 255, g: 181, b: 71 }} intensity={0.5} style={{ top: -40, bottom: -40, left: -40, right: -40 }} />
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.accentText, fontSize: 48, fontWeight: '300', lineHeight: 52 }}>+</Text>
          </View>
        </View>
        <Text style={[styles.title, { textAlign: 'center' }]}>{t('Ajouter ma première lumière')}</Text>
      </Pressable>
    </View>
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
