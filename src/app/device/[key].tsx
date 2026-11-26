import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Text, TextInput, View } from 'react-native';

import { FAMILIES, playStoreUrl } from '../../core/families';
import { canPower, irRemoteOf, setPower, type Target } from '../../services/control';
import { foundDevice } from '../../services/scan';
import { rememberState, removeDevice, updateDevice, useSavedDevice } from '../../services/store';
import { EffectsPanel } from '../../ui/EffectsPanel';
import { ElkControls } from '../../ui/ElkControls';
import { IrControls } from '../../ui/IrControls';
import { Button, Muted, Screen, SectionTitle, styles } from '../../ui/kit';
import { LightStrip, PowerButton } from '../../ui/light';
import { kindLabel } from '../../ui/labels';
import { RoomPicker } from '../../ui/RoomPicker';
import { colors, radius, space } from '../../ui/theme';
import { t } from '../../i18n';

/**
 * Fiche d'un ruban enregistré : sa lumière, ses commandes, puis sa pièce et son nom.
 * Un appareil trouvé mais pas encore géré (Tuya…) y montre seulement quoi faire.
 */
export default function DeviceScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const saved = useSavedDevice(key);
  const detected = key ? foundDevice(key) : undefined;
  const device: Target | undefined = saved ?? detected;
  const [name, setName] = useState(saved?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!device) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Muted>{t('Cet appareil n’est plus dans la liste. Relance une recherche.')}</Muted>
      </View>
    );
  }
  // Trouvé et pilotable mais pas encore ajouté : c'est l'écran d'ajout qui s'en occupe.
  if (!saved && canPower(device)) return <Redirect href={{ pathname: '/new/[key]', params: { key: device.key } }} />;

  const source = saved ?? detected!;
  const irRemote = saved ? irRemoteOf(saved) : undefined;
  const toggleOnly = !!irRemote && !irRemote.keys.some((k) => k.kind === 'power-off');
  const family = FAMILIES[source.family];
  const title = saved?.name ?? kindLabel(source.transport);
  const on = saved?.state?.on ?? false;

  const toggle = (): void => {
    setBusy(true);
    setPower(device, !on)
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const rename = (): void => {
    const trimmed = name.trim();
    if (saved && trimmed) void updateDevice(saved.key, { name: trimmed });
  };

  const forget = (): void =>
    Alert.alert(t('Oublier cet appareil ?'), title, [
      { text: t('Annuler'), style: 'cancel' },
      {
        text: t('Oublier'),
        style: 'destructive',
        onPress: () => {
          void removeDevice(source.key);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title }} />

      {canPower(device) && (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md, overflow: 'hidden' }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View>
              <Text style={styles.big}>{on ? t('Allumé') : t('Éteint')}</Text>
              <Muted>{source.transport === 'ir' ? t('Infrarouge') : source.transport === 'ble' ? 'Bluetooth' : 'Wi-Fi'}</Muted>
            </View>
            <PowerButton
              on={on}
              rgb={saved?.state?.rgb}
              onPress={toggle}
              onLongPress={toggleOnly && saved ? () => void rememberState(saved.key, { on: !on }) : undefined}
              busy={busy}
              size={68}
              label={on ? t('Éteindre') : t('Allumer')}
            />
          </View>
          <LightStrip on={on} rgb={saved?.state?.rgb} height={10} />
          {toggleOnly && <Muted>{t('Allumé et éteint inversés ? Appui long pour corriger.')}</Muted>}
          {error && <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text>}
        </View>
      )}

      {!canPower(device) && (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}>
          <Text style={styles.title}>{source.family === 'tuya' ? t('Système fermé') : t('Pas encore géré')}</Text>
          <Muted>
            {source.family === 'tuya' ? t('Verrouillé par son fabricant.') : t('L’appli ne sait pas encore le piloter.')}{' '}
            {t('Il a une télécommande ? Ajoute-le en infrarouge.')}
          </Muted>
          <View style={styles.row}>
            <Button label={t('Ajouter en infrarouge')} onPress={() => router.push('/ir-new')} style={{ flex: 1 }} />
            {family.apps[0] && (
              <Button label={family.apps[0].name} variant="secondary" onPress={() => void Linking.openURL(playStoreUrl(family.apps[0]))} style={{ flex: 1 }} />
            )}
          </View>
        </View>
      )}

      {saved && source.family === 'elk-bledom' && (
        <>
          <SectionTitle>{t('Lumière')}</SectionTitle>
          <ElkControls target={device} />
          <SectionTitle>{t('Effets')}</SectionTitle>
          <EffectsPanel target={device} />
        </>
      )}

      {source.family === 'ir-nec' && saved && irRemote && (
        <>
          <SectionTitle>{t('Lumière')}</SectionTitle>
          <IrControls target={saved} />
        </>
      )}

      {saved && (
        <>
          <SectionTitle>{t('Pièce')}</SectionTitle>
          <RoomPicker value={saved.roomId} onChange={(roomId) => void updateDevice(saved.key, { roomId })} />

          <SectionTitle>{t('Nom')}</SectionTitle>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('Ex. Néon du salon')}
            placeholderTextColor={colors.textDim}
            returnKeyType="done"
            onSubmitEditing={rename}
          />
          {!!name.trim() && name.trim() !== saved.name && <Button label={t('Enregistrer le nom')} onPress={rename} />}

          {canPower(device) && family.apps[0] && (
            <Button label={t('Ouvrir avec {app}', { app: family.apps[0].name })} variant="ghost" onPress={() => void Linking.openURL(playStoreUrl(family.apps[0]))} />
          )}
          <Button label={t('Oublier ce ruban')} variant="ghost" onPress={forget} />
        </>
      )}
    </Screen>
  );
}
