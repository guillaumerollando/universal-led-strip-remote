import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { DetectedDevice } from '../core/identify';
import { productName, ownName, stripKind } from '../core/describe';
import { FAMILIES } from '../core/families';
import { canPower } from '../services/control';
import { hasIrEmitter } from '../services/ir';
import { stopScan, useScan } from '../services/scan';
import { useSavedDevices, type SavedDevice } from '../services/store';
import { Button, Muted, Screen, SectionTitle, styles } from '../ui/kit';
import { kindLabel, signalText } from '../ui/labels';
import { LedRow } from '../ui/LedRow';
import { colors, radius, space } from '../ui/theme';
import { t } from '../i18n';

/**
 * Ajouter un ruban : la recherche démarre toute seule ; on touche un ruban trouvé pour l'ajouter.
 * Les appareils que l'appli ne sait pas piloter passent en dessous, en petit.
 */
export default function AddScreen() {
  const saved = useSavedDevices();
  const { scanning, found, warnings, demo, start } = useScan();

  useEffect(() => {
    if (!scanning && !demo) start();
    return stopScan;
    // Une seule recherche à l'ouverture de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedOf = (d: DetectedDevice): SavedDevice | undefined => saved.find((s) => s.key === d.key);
  // Un pont Hue dont les lampes sont déjà listées n'a plus besoin d'apparaître.
  const linked = new Set(found.filter((d) => d.family === 'hue').map((d) => d.key.split(':')[1]));
  const visible = found.filter((d) => !(d.family === 'hue-bridge' && linked.has(d.meta?.bridge ?? '')));
  const pairable = (d: DetectedDevice): boolean => !!FAMILIES[d.family].pairing && !canPower(d);
  const ready = visible.filter((d) => canPower(d) || pairable(d));
  const others = visible.filter((d) => !canPower(d) && !pairable(d));

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <LedRow mode={scanning ? 'chase' : found.length ? 'lit' : 'off'} count={9} size={14} />
        <Text style={[styles.title, { textAlign: 'center' }]}>{scanning ? t('Recherche en cours…') : found.length ? t('Touche une lumière pour l’ajouter') : t('Rien trouvé pour l’instant.')}</Text>
        <Muted>{t('Allume tes lumières et approche-toi.')}</Muted>
      </View>
      {warnings.map((w) => (
        <Text key={w} style={[styles.muted, { color: colors.warn }]}>
          {w}
        </Text>
      ))}

      {ready.map((d) => (
        <FoundRow key={d.key} device={d} saved={savedOf(d)} />
      ))}

      {!scanning && <Button label={t('Chercher encore')} variant="secondary" onPress={start} />}

      {others.length > 0 && (
        <>
          <SectionTitle>{t('Autres appareils')}</SectionTitle>
          {others.map((d) => (
            <FoundRow key={d.key} device={d} saved={savedOf(d)} quiet />
          ))}
        </>
      )}

      {hasIrEmitter() && (
        <>
          <SectionTitle>{t('Ruban à télécommande')}</SectionTitle>
          <Button label={t('Ajouter un ruban à télécommande')} variant="secondary" onPress={() => router.push('/ir-new')} />
        </>
      )}

      {/* Pour les bricoleurs (Tasmota, WLED sans mDNS…) : discret, en bas, jamais sur le chemin. */}
      <Pressable accessibilityRole="link" hitSlop={10} onPress={() => router.push('/add-ip')} style={{ alignSelf: 'center', paddingVertical: space.md }}>
        <Text style={[styles.muted, { textDecorationLine: 'underline' }]}>{t('Ajouter par adresse IP')}</Text>
      </Pressable>
    </Screen>
  );
}

/** Un appareil trouvé : ce que c'est, à quelle distance, et ce qu'on peut faire en le touchant. */
function FoundRow({ device, saved, quiet }: { device: DetectedDevice; saved?: SavedDevice; quiet?: boolean }) {
  const signal = signalText(device.rssi);
  const family = FAMILIES[device.family];
  const app = family.apps[0];
  const product = productName(device);
  const kind = stripKind(device);
  // Marque connue : son nom ; sinon ce que c'est (« Ruban à pixels », « Ruban Bluetooth »). Le nom propre de
  // l'appareil (« WLED-Bureau », « ELK-BLEDOM ») reste en petit pour distinguer deux appareils pareils.
  const title = saved?.name ?? product ?? (kind ? t(kind) : kindLabel(device));
  const detail = [signal, family.closed ? t('Système fermé') : ownName(device)].filter(Boolean).join(' · ');
  const open = (): void => {
    if (saved || quiet) router.push({ pathname: '/device/[key]', params: { key: device.key } });
    else router.push({ pathname: '/new/[key]', params: { key: device.key } });
  };
  const action = saved ? t('déjà ajouté') : quiet ? (app ? t('Via {app}', { app: app.name }) : '') : family.pairing && !canPower(device) ? t('Relier') : t('Ajouter');

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: !quiet && !saved ? colors.accent : colors.border,
        paddingHorizontal: space.lg,
        paddingVertical: quiet ? space.sm : space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={quiet ? styles.text : styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!detail && (
          <Text style={styles.muted} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      {!!action && <Text style={[styles.muted, !quiet && !saved && { color: colors.accent, fontWeight: '700', fontSize: 15 }]}>{action}</Text>}
    </Pressable>
  );
}
