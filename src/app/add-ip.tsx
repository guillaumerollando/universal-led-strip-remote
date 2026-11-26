import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';

import { isIpv4 } from '../core/probe';
import { probeIp } from '../services/probe';
import { putFound } from '../services/scan';
import { Button, Muted, Screen, styles } from '../ui/kit';
import { colors } from '../ui/theme';
import { t } from '../i18n';

/** Ajout par adresse IP : pour un appareil que la recherche ne voit pas (Tasmota, WLED sans mDNS…). */
export default function AddIpScreen() {
  const [ip, setIp] = useState('192.168.1.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = (): void => {
    setBusy(true);
    setError(null);
    void probeIp(ip.trim())
      .then((d) => {
        if (!d) return setError(t('Rien de connu à cette adresse.'));
        putFound([d]);
        router.replace({ pathname: '/new/[key]', params: { key: d.key } });
      })
      .finally(() => setBusy(false));
  };

  return (
    <Screen>
      <Muted>{t('Adresse IP')}</Muted>
      <TextInput
        style={styles.input}
        value={ip}
        onChangeText={setIp}
        keyboardType="decimal-pad"
        autoFocus
        returnKeyType="search"
        onSubmitEditing={search}
        placeholderTextColor={colors.textDim}
      />
      <Button label={t('Chercher')} onPress={search} busy={busy} disabled={!isIpv4(ip)} />
      {error && <Text style={[styles.muted, { color: colors.warn }]}>{error}</Text>}
    </Screen>
  );
}
