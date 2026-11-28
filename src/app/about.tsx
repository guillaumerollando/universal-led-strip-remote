import Constants from 'expo-constants';
import { useState } from 'react';
import { Image, Linking, Pressable, Share, Text, View } from 'react-native';

import { reportProblem, SUPPORT_MAIL } from '../services/report';
import { Muted, Screen, SectionTitle, styles } from '../ui/kit';
import { SignatureStrip } from '../ui/light';
import { colors, radius, space } from '../ui/theme';
import { t } from '../i18n';

const LINKS = {
  source: 'https://github.com/guillaumerollando/universal-led-strip-remote',
  studio: 'https://rollandostudio.com',
  privacy: 'https://guillaumerollando.github.io/led-strip-remote/privacy',
  store: 'https://play.google.com/store/apps/details?id=com.rollandostudio.ledstripremote',
  storeApp: 'market://details?id=com.rollandostudio.ledstripremote',
};

/** Bibliothèques open source principales (noms propres : pas de traduction). */
const CREDITS = [
  'React Native',
  'Expo',
  'Expo Router',
  'React Native Reanimated',
  'React Native BLE PLX',
  'React Native SVG',
  'React Native UDP',
  'React Native Keyboard Controller',
  'AsyncStorage',
  'Noble ciphers & hashes',
];

/** « À propos » : discret, ouvert depuis le petit ⓘ de l'accueil. */
export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '';
  const [noMail, setNoMail] = useState(false);

  const share = (): void => void Share.share({ message: `${t('Une seule appli pour piloter tous tes rubans LED et tes ampoules :')} ${LINKS.store}` });
  const rate = (): void => void Linking.openURL(LINKS.storeApp).catch(() => Linking.openURL(LINKS.store));
  const report = (): void => void reportProblem(t('À propos')).then((ok) => setNoMail(!ok));

  return (
    <Screen>
      <View style={{ gap: space.xs, marginTop: space.md }}>
        <SignatureStrip>
          <Text style={[styles.big, { fontSize: 28, textAlign: 'center' }]}>{t('Ruban LED')}</Text>
          <Text style={[styles.text, { color: colors.accent, textAlign: 'center', marginBottom: space.sm }]}>
            {t('Une appli pour les gouverner tous')}
          </Text>
        </SignatureStrip>
        <View style={{ alignItems: 'center', gap: space.xs, marginTop: space.lg }}>
          <Muted>{t('Version {v}', { v: version })}</Muted>
          <Text style={[styles.text, { textAlign: 'center' }]}>{t('Gratuite, sans pub, sans compte.')}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: space.md }}>
        <ActionRow icon="↗" label={t('Partager l’appli')} detail={t('L’envoyer à un proche')} onPress={share} />
        <ActionRow icon="★" label={t('Noter l’appli')} detail={t('Un avis aide les autres à la trouver')} onPress={rate} divider />
        <ActionRow icon="✉" label={t('Signaler un problème')} detail={t('On lit tout et on répond')} onPress={report} divider />
      </View>
      {noMail && (
        <Text selectable style={[styles.muted, { textAlign: 'center' }]}>
          {t('Aucune appli de mail trouvée : écris-nous à {mail}', { mail: SUPPORT_MAIL })}
        </Text>
      )}

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
        <LinkRow label={t('Open source')} detail="GPL-3.0" url={LINKS.source} />
        <LinkRow label={t('Politique de confidentialité')} url={LINKS.privacy} divider />
      </View>

      <StudioCard />

      <SectionTitle>{t('Crédits')}</SectionTitle>
      <Muted>{CREDITS.join(' · ')}</Muted>
    </Screen>
  );
}

/** « Fait avec soin par » + le logo du studio, comme dans les autres applis Rollando Studio. */
function StudioCard() {
  const open = (): void => void Linking.openURL(LINKS.studio);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${t('Fait avec soin par')} Rollando Studio`}
      onPress={open}
      style={({ pressed }) => ({
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.lg,
        paddingHorizontal: space.lg,
        marginTop: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
      })}
    >
      <Muted>{t('Fait avec soin par')}</Muted>
      <Image source={require('../../assets/rollando-studio.png')} accessibilityIgnoresInvertColors style={{ width: 150, height: 150 * (249 / 900) }} resizeMode="contain" />
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>{t('Découvrir nos autres applis')}</Text>
    </Pressable>
  );
}

/** Une action du studio (partager, noter, signaler) : icône, titre, petite phrase. */
function ActionRow({ icon, label, detail, onPress, divider }: { icon: string; label: string; detail: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { minHeight: 64, paddingHorizontal: space.lg, gap: space.md, backgroundColor: pressed ? colors.surfaceHigh : 'transparent' },
        divider && { borderTopWidth: 1, borderTopColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.accent, width: 22, textAlign: 'center' }]}>{icon}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.text}>{label}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Text style={[styles.title, { color: colors.textDim }]}>›</Text>
    </Pressable>
  );
}

function LinkRow({ label, detail, url, divider }: { label: string; detail?: string; url: string; divider?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [
        styles.row,
        { minHeight: 52, paddingHorizontal: space.lg, backgroundColor: pressed ? colors.surfaceHigh : 'transparent' },
        divider && { borderTopWidth: 1, borderTopColor: colors.border },
      ]}
    >
      <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
      {detail && <Text style={styles.muted}>{detail}</Text>}
      <Text style={[styles.title, { color: colors.textDim }]}>›</Text>
    </Pressable>
  );
}
