import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { FAMILIES, playStoreUrl } from '../../core/families';
import { canColor, canDim, canPower, effectsFor, irRemoteOf, setPower, type Target } from '../../services/control';
import { foundDevice } from '../../services/scan';
import { rememberState, useSavedDevice } from '../../services/store';
import { DeviceOptions } from '../../ui/DeviceOptions';
import { EffectsPanel } from '../../ui/EffectsPanel';
import { ElkControls } from '../../ui/ElkControls';
import { IrControls } from '../../ui/IrControls';
import { Button, Muted, Screen, SectionTitle, styles } from '../../ui/kit';
import { LightStrip, PowerButton } from '../../ui/light';
import { StripSlider } from '../../ui/StripSlider';
import { kindLabel } from '../../ui/labels';
import { colors, radius, space } from '../../ui/theme';
import { t } from '../../i18n';

/**
 * Fiche d'un ruban enregistré : sa lumière et ses commandes. Nom, pièce, oublier : « ⋯ » en haut (ou appui long sur la tuile).
 * Un appareil trouvé mais pas encore géré (Tuya…) y montre seulement quoi faire.
 */
export default function DeviceScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const saved = useSavedDevice(key);
  const detected = key ? foundDevice(key) : undefined;
  const device: Target | undefined = saved ?? detected;
  const [options, setOptions] = useState(false);
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

  return (
    <Screen>
      <Stack.Screen
        options={{
          title,
          headerRight: saved
            ? () => (
                <Pressable accessibilityRole="button" accessibilityLabel={t('Réglages')} hitSlop={12} onPress={() => setOptions(true)}>
                  <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700', paddingHorizontal: space.sm }}>⋯</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

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
          {saved && on && canDim(device) ? (
            <StripSlider target={saved} on={on} rgb={saved.state?.rgb} height={10} onTap={() => undefined} onLongPress={() => undefined} onError={setError} />
          ) : (
            <LightStrip on={on} rgb={saved?.state?.rgb} height={10} />
          )}
          {toggleOnly && <Muted>{t('Allumé et éteint inversés ? Appui long pour corriger.')}</Muted>}
          {error && <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text>}
        </View>
      )}

      {!canPower(device) && (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}>
          <Text style={styles.title}>{family.closed ? t('Système fermé') : t('Pas encore géré')}</Text>
          <Muted>
            {family.closed ? t('Impossible de le piloter ici.') : source.family === 'govee' ? t('Active « Contrôle LAN » dans Govee Home : l’appli le pilotera en Wi-Fi.') : t('L’appli ne sait pas encore le piloter.')}{' '}
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

      {saved && (canColor(device) || canDim(device)) && (
        <>
          <SectionTitle>{t('Lumière')}</SectionTitle>
          <ElkControls target={device} />
        </>
      )}
      {saved && effectsFor(device).length > 0 && (
        <>
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

      {saved && canPower(device) && family.apps[0] && (
        <Button label={t('Ouvrir avec {app}', { app: family.apps[0].name })} variant="ghost" onPress={() => void Linking.openURL(playStoreUrl(family.apps[0]))} />
      )}
      {saved && <DeviceOptions device={saved} visible={options} onClose={() => setOptions(false)} onForgotten={() => router.back()} />}
    </Screen>
  );
}
