import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FAMILIES } from '../core/families';
import { canDim, canPower, effectsFor, setPower } from '../services/control';
import { markLongPressSeen } from '../services/hints';
import type { SavedDevice } from '../services/store';
import { DeviceOptions } from './DeviceOptions';
import { styles as kit } from './kit';
import { LightStrip, PowerButton } from './light';
import { StripSlider } from './StripSlider';
import { colors, radius, space } from './theme';
import { t } from '../i18n';

/** L'état en mots : « Éteint », « Allumé · 60 % », ou le nom de l'effet en cours. */
function stateText(device: SavedDevice): string {
  if (!device.state?.on) return t('Éteint');
  const effect = device.state.effect && effectsFor(device).find((e) => e.id === device.state?.effect);
  if (effect) return t(effect.label);
  const level = device.state.brightness;
  return level !== undefined && level < 100 ? `${t('Allumé')} · ${level} %` : t('Allumé');
}

/**
 * Un ruban dans une liste : son nom, sa lumière, et le bouton marche/arrêt à portée de pouce.
 * Toucher = ses commandes (couleurs, effets) ; appui long = ses réglages (nom, pièce, oublier).
 */
export function DeviceTile({ device, nearby }: { device: SavedDevice; nearby?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState(false);
  // Un message d'échec s'efface tout seul : la tuile ne reste pas en erreur.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);
  const on = device.state?.on ?? false;
  const family = FAMILIES[device.family];
  const controllable = canPower(device);

  const open = (): void => router.push({ pathname: '/device/[key]', params: { key: device.key } });
  const settings = (): void => {
    markLongPressSeen();
    setOptions(true);
  };
  const toggle = (): void => {
    setBusy(true);
    setPower(device, !on)
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Pressable
      onPress={open}
      onLongPress={settings}
      accessibilityRole="button"
      accessibilityLabel={`${device.name}, ${controllable ? stateText(device) : family.closed ? t('Système fermé') : t('Pas encore géré')}`}
      accessibilityHint={t('Appui long : réglages')}
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
            {controllable ? stateText(device) : family.closed ? t('Système fermé') : t('Pas encore géré')}
            {nearby && !on ? ` · ${t('à portée')}` : ''}
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
      {controllable &&
        (on && canDim(device) ? (
          <StripSlider target={device} on={on} rgb={device.state?.rgb} onTap={open} onLongPress={settings} onError={setError} />
        ) : (
          <LightStrip on={on} rgb={device.state?.rgb} height={6} />
        ))}
      {error && <Text style={[kit.muted, { color: colors.danger }]}>{error}</Text>}
      <DeviceOptions device={device} visible={options} onClose={() => setOptions(false)} />
    </Pressable>
  );
}
