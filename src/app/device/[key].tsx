import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { FAMILIES, playStoreUrl } from '../../core/families';
import { ambiancesFor, canColor, canDim, canWhite, canPower, catalogFor, effectsFor, irRemoteOf, lightColors, setPower, type Target } from '../../services/control';
import { foundDevice } from '../../services/scan';
import { rememberState, useSavedDevice } from '../../services/store';
import { AmbiancesPanel } from '../../ui/AmbiancesPanel';
import { useFavorites } from '../../services/favorites';
import { DeviceOptions } from '../../ui/DeviceOptions';
import { EffectsPanel } from '../../ui/EffectsPanel';
import { ElkControls } from '../../ui/ElkControls';
import { IrControls } from '../../ui/IrControls';
import { Button, Muted, Screen, SectionTitle, styles } from '../../ui/kit';
import { LightStrip, PowerButton } from '../../ui/light';
import { StripSlider } from '../../ui/StripSlider';
import { LoadingBorder } from '../../ui/LoadingBorder';
import { useSending } from '../../services/sending';
import { kindLabel } from '../../ui/labels';
import { colors, radius, space } from '../../ui/theme';
import { t } from '../../i18n';

/** Méthode libre pour remplacer le logiciel Tuya par Wi-Fi (projet open source, sa page explique tout). */
const FREE_FIRMWARE_URL = 'https://github.com/tuya-cloudcutter/tuya-cloudcutter';

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
  const favs = useFavorites();
  /** Allumer, éteindre, luminosité (ruban-curseur) : le contour de la carte du haut tourne pendant l'envoi. */
  const heroSending = useSending(key, ['power', 'brightness']);
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
  const title = saved?.name ?? kindLabel(source);
  const on = saved?.state?.on ?? false;
  const palette = saved ? lightColors(saved) : undefined;
  // Favoris en tête de fiche : ambiances (si ce ruban en joue) et effets de son contrôleur.
  const favAmb = !!saved && ambiancesFor(saved).length > 0 && favs.some((k) => k.startsWith('amb:'));
  const favFx = !!saved && [...effectsFor(saved), ...catalogFor(saved)].some((e) => favs.includes(`fx:${e.code}`));

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
              palette={palette}
              onPress={toggle}
              onLongPress={toggleOnly && saved ? () => void rememberState(saved.key, { on: !on }) : undefined}
              busy={busy}
              size={68}
              label={on ? t('Éteindre') : t('Allumer')}
            />
          </View>
          {saved && on && canDim(device) ? (
            <StripSlider target={saved} on={on} rgb={saved.state?.rgb} palette={palette} height={10} onTap={() => undefined} onLongPress={() => undefined} onError={setError} />
          ) : (
            <LightStrip on={on} rgb={saved?.state?.rgb} palette={palette} height={10} />
          )}
          {toggleOnly && <Muted>{t('Allumé et éteint inversés ? Appui long pour corriger.')}</Muted>}
          {error && <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text>}
          <LoadingBorder active={heroSending} radius={radius.lg} />
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

      {!canPower(device) && family.closed && (
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: space.lg, gap: space.sm }}>
          <Text style={styles.title}>{t('Cet appareil est à toi')}</Text>
          <Muted>
            {t(
              'Son fabricant le verrouille, mais beaucoup peuvent recevoir un logiciel libre, souvent par Wi-Fi, sans ouvrir le boîtier. L’appli le pilote alors directement, effets compris. Selon ton pays, la loi l’autorise ou non : renseigne-toi. C’est de la bidouille, à tes risques, et la garantie peut ne plus s’appliquer.',
            )}
          </Muted>
          <Button label={t('En savoir plus')} variant="ghost" onPress={() => void Linking.openURL(FREE_FIRMWARE_URL)} />
        </View>
      )}

      {saved && (favAmb || favFx) && (
        <>
          <SectionTitle>{t('Favoris')}</SectionTitle>
          {favAmb && <AmbiancesPanel target={saved} favoritesOnly />}
          {favFx && <EffectsPanel target={saved} favoritesOnly />}
        </>
      )}
      {saved && (canColor(device) || canWhite(device) || canDim(device)) && (
        <>
          <SectionTitle>{t('Lumière')}</SectionTitle>
          <ElkControls target={device} />
        </>
      )}
      {source.family === 'ir-nec' && saved && irRemote && (
        <>
          <SectionTitle>{t('Lumière')}</SectionTitle>
          <IrControls target={saved} />
        </>
      )}
      {saved && ambiancesFor(device).length > 0 && (
        <>
          <SectionTitle>{t('Ambiances')}</SectionTitle>
          <AmbiancesPanel target={saved} />
        </>
      )}
      {saved && (effectsFor(device).length > 0 || catalogFor(device).length > 0) && (
        <>
          <SectionTitle>{t('Effets')}</SectionTitle>
          <EffectsPanel target={device} />
        </>
      )}


      {saved && canPower(device) && family.apps[0] && (
        <Button label={t('Ouvrir avec {app}', { app: family.apps[0].name })} variant="ghost" onPress={() => void Linking.openURL(playStoreUrl(family.apps[0]))} />
      )}
      {saved && <DeviceOptions device={saved} visible={options} onClose={() => setOptions(false)} onForgotten={() => router.back()} />}
    </Screen>
  );
}
