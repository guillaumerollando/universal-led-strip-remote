import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { FAMILIES, type Transport } from '../core/families';
import { hasIrEmitter } from '../services/ir';
import { SCAN_MS, useScan } from '../services/scan';
import { useSavedDevices } from '../services/store';
import { Badge, Button, Card, Muted, Screen, SectionTitle, styles } from '../ui/kit';
import { colors } from '../ui/theme';
import { t } from '../i18n';

const TRANSPORT_LABEL: Record<Transport, string> = { ble: 'Bluetooth', wifi: 'Wi-Fi', ir: t('Infrarouge') };

/** Force du signal Bluetooth en mots (le RSSI ne parle à personne). */
function signalLabel(rssi?: number): string | null {
  if (rssi === undefined) return null;
  if (rssi > -65) return t('tout près');
  if (rssi > -80) return t('à portée');
  return t('loin');
}

/** Ajouter un ruban : scanner Bluetooth + Wi-Fi, ou déclarer un ruban infrarouge. */
export default function AddScreen() {
  const saved = useSavedDevices();
  const { scanning, found, warnings, start } = useScan();
  const savedKeys = new Set(saved.map((d) => d.key));

  return (
    <Screen>
      <SectionTitle>{t('Bluetooth et Wi-Fi')}</SectionTitle>
      <Muted>{t('Allume les rubans et reste à quelques mètres. L’appli reconnaît le contrôleur et l’appli qui va avec.')}</Muted>
      <Button label={scanning ? t('Recherche en cours…') : t('Chercher autour de moi')} onPress={start} busy={scanning} />
      {scanning && <Muted>{t('Environ {s} secondes.', { s: Math.round(SCAN_MS / 1000) })}</Muted>}
      {warnings.map((w) => (
        <Text key={w} style={[styles.muted, { color: colors.warn }]}>
          {w}
        </Text>
      ))}
      {found.map((d) => {
        const family = FAMILIES[d.family];
        const signal = signalLabel(d.rssi);
        const known = savedKeys.has(d.key);
        return (
          <Card key={d.key} onPress={() => router.push({ pathname: '/device/[key]', params: { key: d.key } })}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={styles.title}>{known ? saved.find((s) => s.key === d.key)?.name : t(family.label)}</Text>
              {known ? (
                <Badge label={t('déjà ajouté')} />
              ) : (
                <Badge label={d.confidence === 'sure' ? t('sûr') : t('probable')} tone={d.confidence === 'sure' ? 'ok' : 'warn'} />
              )}
            </View>
            <Muted>
              « {d.rawName} » · {TRANSPORT_LABEL[d.transport]}
              {signal ? ` · ${signal}` : ''}
              {d.transport === 'wifi' ? ` · ${d.address}` : ''}
            </Muted>
            {family.apps[0] && <Text style={styles.text}>{t('Appli d’origine : {apps}', { apps: family.apps.map((a) => a.name).join(', ') })}</Text>}
          </Card>
        );
      })}
      {!scanning && found.length === 0 && <Muted>{t('Rien trouvé pour l’instant.')}</Muted>}

      {hasIrEmitter() && (
        <>
          <SectionTitle>{t('Ruban à télécommande')}</SectionTitle>
          <Muted>{t('Ton téléphone peut remplacer sa télécommande infrarouge.')}</Muted>
          <Button label={t('Ajouter un ruban à télécommande')} variant="secondary" onPress={() => router.push('/ir-new')} />
        </>
      )}
    </Screen>
  );
}
