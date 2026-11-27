import Constants from 'expo-constants';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { Muted, Screen, SectionTitle, styles } from '../ui/kit';
import { SignatureStrip } from '../ui/light';
import { colors, radius, space } from '../ui/theme';
import { t } from '../i18n';

const LINKS = {
  source: 'https://github.com/guillaumerollando/universal-led-strip-remote',
  studio: 'https://rollandostudio.com',
  privacy: 'https://guillaumerollando.github.io/led-strip-remote/privacy',
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
        gap: space.md,
        paddingVertical: space.xl,
        paddingHorizontal: space.lg,
        marginTop: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
      })}
    >
      <Muted>{t('Fait avec soin par')}</Muted>
      <Image source={require('../../assets/rollando-studio.png')} accessibilityIgnoresInvertColors style={{ width: 210, height: 210 * (249 / 900) }} resizeMode="contain" />
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>{t('Découvrir nos autres applis')}</Text>
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
