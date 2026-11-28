import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';

import { FAMILIES, playStoreUrl } from '../core/families';
import { is24GHz } from '../core/setupAp';
import { startScan, useScan } from '../services/scan';
import { canConnectFromApp, canScanQr, giveHomeWifi, homeChoices, scanWifiQr, SetupError, type SetupProgress } from '../services/wifiSetup';
import { Button, Muted, Screen, SectionTitle, styles } from '../ui/kit';
import { Chip } from '../ui/light';
import { LedRow } from '../ui/LedRow';
import { colors, space } from '../ui/theme';
import { t } from '../i18n';

type Phase = { step: 'form' } | { step: 'busy'; progress: SetupProgress } | { step: 'failed'; reason: 'connect' | 'send' } | { step: 'manual' };

const PROGRESS: Record<SetupProgress, () => string> = {
  connecting: () => t('Connexion à la lumière…'),
  sending: () => t('Envoi de ton Wi-Fi à la lumière…'),
  restarting: () => t('La lumière redémarre et rejoint ton Wi-Fi…'),
};

/**
 * Lumière Wi-Fi neuve : on lui donne le Wi-Fi de la maison sans passer par son adresse 192.168.4.1. Le nom du réseau
 * est proposé, il ne reste que le mot de passe ; l'appli fait le reste, puis relance la recherche pour l'ajouter.
 */
export default function SetupWifiScreen() {
  const { ssid: apSsid } = useLocalSearchParams<{ ssid: string }>();
  const { waiting } = useScan();
  const light = waiting.find((w) => w.ssid === apSsid);
  const { networks, current } = useMemo(homeChoices, []);
  // Le premier réseau proposé (le 2,4 GHz de la box si le téléphone est sur son 5 GHz), sinon le réseau actuel.
  const [home, setHome] = useState(networks[0]?.ssid ?? current ?? '');
  const [typed, setTyped] = useState(!networks.length);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>({ step: 'form' });
  const [qrNote, setQrNote] = useState('');

  if (!light) {
    return (
      <Screen>
        <Muted>{t('Cette lumière n’est plus visible. Rallume-la et relance la recherche.')}</Muted>
        <Button label={t('Retour')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const family = FAMILIES[light.ap.family];
  const name = family.brand ?? t('Lumière Wi-Fi');

  // Système fermé : on ne sait pas lui parler, on dit quoi faire.
  if (light.ap.method === 'closed') {
    const app = family.apps[0];
    return (
      <Screen>
        <Text style={styles.big}>{name}</Text>
        <Muted>{t('Cette lumière attend son Wi-Fi, mais elle ne se configure qu’avec l’appli de sa marque. Une fois sur ton Wi-Fi, ajoute-la en infrarouge si elle a une télécommande.')}</Muted>
        {app && <Button label={t('Ouvrir avec {app}', { app: app.name })} onPress={() => void Linking.openURL(playStoreUrl(app))} />}
      </Screen>
    );
  }

  const chosen = networks.find((n) => n.ssid === home);
  const fromQr = async (image = false): Promise<void> => {
    const res = await scanWifiQr(image);
    if (res === 'cancelled') return;
    if (res === 'not-wifi') return setQrNote(t('Ce QR code n’est pas celui d’un Wi-Fi.'));
    setQrNote('');
    setHome(res.ssid);
    setTyped(!networks.some((n) => n.ssid === res.ssid));
    setPassword(res.password);
  };
  const run = async (manual = false): Promise<void> => {
    try {
      await giveHomeWifi(light, home.trim(), password, (progress) => setPhase({ step: 'busy', progress }), manual);
      // Elle a rejoint la maison : nouvelle recherche, elle y apparaît comme une lumière à ajouter.
      void startScan();
      router.back();
    } catch (e) {
      setPhase({ step: 'failed', reason: e instanceof SetupError ? e.reason : 'send' });
    }
  };
  const start = (): void => {
    if (canConnectFromApp()) void run();
    else setPhase({ step: 'manual' });
  };

  if (phase.step === 'busy') {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.xl }}>
          <LedRow mode="chase" count={9} size={14} />
          <Text style={[styles.title, { textAlign: 'center' }]}>{PROGRESS[phase.progress]()}</Text>
          {phase.progress === 'connecting' && <Muted>{t('Android va te demander de te connecter à la lumière : accepte.')}</Muted>}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.big}>{name}</Text>
      <Muted>{t('Cette lumière n’est pas encore sur ton Wi-Fi. Donne-lui ton Wi-Fi, l’appli s’occupe du reste.')}</Muted>

      {phase.step === 'failed' && (
        <Text style={[styles.muted, { color: colors.warn }]}>
          {phase.reason === 'connect'
            ? t('Le téléphone n’a pas pu se connecter à la lumière. Approche-toi et réessaie.')
            : t('La lumière n’a pas répondu. Vérifie le mot de passe et réessaie.')}
        </Text>
      )}

      {phase.step === 'manual' ? (
        <>
          <Muted>{t('Dans les réglages Wi-Fi, connecte-toi au réseau « {ssid} », puis reviens ici.', { ssid: light.ssid })}</Muted>
          <Button label={t('Ouvrir les réglages Wi-Fi')} variant="secondary" onPress={() => void Linking.sendIntent('android.settings.WIFI_SETTINGS')} />
          <Button label={t('C’est fait')} onPress={() => void run(true)} />
        </>
      ) : (
        <>
          <SectionTitle>{t('Ton Wi-Fi')}</SectionTitle>
          {canScanQr() && (
            <>
              <Button label={t('Scanner le QR code du Wi-Fi')} variant="secondary" onPress={() => void fromQr()} />
              <Button label={t('Choisir une image du QR code')} variant="secondary" onPress={() => void fromQr(true)} />
            </>
          )}
          {!!qrNote && <Text style={[styles.muted, { color: colors.warn }]}>{qrNote}</Text>}
          {!typed && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {networks.slice(0, 6).map((n) => (
                <Chip key={n.ssid} label={n.ssid} selected={n.ssid === home} onPress={() => setHome(n.ssid)} />
              ))}
              <Chip label={t('Autre…')} onPress={() => (setTyped(true), setHome(''))} />
            </View>
          )}
          {typed && (
            <TextInput
              style={styles.input}
              value={home}
              onChangeText={setHome}
              placeholder={t('Nom du Wi-Fi')}
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
          {chosen && !is24GHz(chosen) && (
            <Text style={[styles.muted, { color: colors.warn }]}>{t('Ce Wi-Fi est en 5 GHz : la lumière ne le capte pas. Choisis le réseau 2,4 GHz de ta box.')}</Text>
          )}

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t('Mot de passe du Wi-Fi')}
            placeholderTextColor={colors.textDim}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable hitSlop={8} onPress={() => setShow((s) => !s)} style={{ alignSelf: 'flex-start' }}>
            <Text style={[styles.muted, { textDecorationLine: 'underline' }]}>{show ? t('Masquer le mot de passe') : t('Afficher le mot de passe')}</Text>
          </Pressable>
          <Muted>{t('Le mot de passe va directement à la lumière : il reste chez toi.')}</Muted>

          <Button label={t('Configurer la lumière')} onPress={start} disabled={!home.trim()} style={{ minHeight: 56 }} />
        </>
      )}
    </Screen>
  );
}
