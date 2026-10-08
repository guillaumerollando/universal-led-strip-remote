import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FAMILIES } from '../core/families';
import { canPower, setPower } from '../services/control';
import type { SavedDevice } from '../services/store';
import { styles as kit } from './kit';
import { LightStrip, PowerButton } from './light';
import { colors, radius, space } from './theme';
import { t } from '../i18n';

const TRANSPORT = { ble: 'Bluetooth', wifi: 'Wi-Fi', ir: t('Infrarouge') };

/** Un ruban dans une liste : son nom, sa lumière, et le bouton marche/arrêt à portée de pouce. */
export function DeviceTile({ device, nearby }: { device: SavedDevice; nearby?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = device.state?.on ?? false;
  const family = FAMILIES[device.family];
  const controllable = canPower(device);

  const toggle = (): void => {
    setBusy(true);
    setPower(device, !on)
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/device/[key]', params: { key: device.key } })}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        gap: space.xs,
      })}
    >
      <View style={[kit.row, { gap: space.md }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={kit.title} numberOfLines={1}>
            {device.name}
          </Text>
          <Text style={kit.muted} numberOfLines={1}>
            {TRANSPORT[device.transport]}
            {nearby ? ` · ${t('à portée')}` : ''}
          </Text>
        </View>
        {controllable ? (
          <PowerButton on={on} rgb={device.state?.rgb} onPress={toggle} busy={busy} label={t(on ? '{name} : éteindre' : '{name} : allumer', { name: device.name })} />
        ) : (
          <Text style={[kit.muted, { maxWidth: 110, textAlign: 'right' }]}>
            {family.apps[0] ? t('Via {app}', { app: family.apps[0].name }) : ''}
          </Text>
        )}
      </View>
      {controllable && <LightStrip on={on} rgb={device.state?.rgb} height={6} />}
      {error && <Text style={[kit.muted, { color: colors.danger }]}>{error}</Text>}
    </Pressable>
  );
}
