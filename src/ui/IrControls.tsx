import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { Rgb } from '../core/elk';
import type { IrKey } from '../core/ir';
import { irRemoteOf, pressIrKey, type Target } from '../services/control';
import { irAimHint } from '../services/ir';
import { Muted, styles as kit } from './kit';
import { Swatch } from './light';
import { colors, radius, space } from './theme';
import { t } from '../i18n';

/** Couleurs d'aperçu des effets, d'après leur nom (les télécommandes ne disent pas ce qu'ils font exactement). */
function effectPreview(key: IrKey): string[] {
  const id = key.id;
  if (id.includes('strobe') || id.includes('flash')) return ['#FFFFFF', '#14161D', '#FF3B3B', '#14161D', '#3FC9FF'];
  if (id.includes('fade') || id.includes('smooth')) return ['#FF3B3B', '#FFE14D', '#4CE07A', '#3FC9FF', '#C25BFF'];
  if (id.includes('jump')) return ['#FF3B3B', '#4CE07A', '#3FC9FF'];
  return ['#FFB547', '#FF5AC8', '#3FC9FF'];
}

function EffectDot({ stops }: { stops: string[] }) {
  const t = useSharedValue(0);
  const input = stops.map((_, i) => i / Math.max(1, stops.length - 1));
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 700 * stops.length, easing: Easing.linear }), -1, true);
  }, [t, stops.length]);
  const style = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.value, input, stops) }));
  return <Animated.View style={[{ width: 30, height: 30, borderRadius: 15 }, style]} />;
}

/** Les effets dont le nom parle à tout le monde ; les réglages fins (Rouge +, Perso 3…) restent sur la télécommande. */
const USEFUL_EFFECTS = ['flash', 'strobe', 'fade', 'smooth', 'play', 'auto', 'jump3', 'jump7', 'fade3', 'fade7'];

/** Couleurs, luminosité et effets d'un ruban infrarouge, dans le style des rubans Bluetooth. */
export function IrControls({ target }: { target: Target }) {
  const [error, setError] = useState<string | null>(null);
  const remote = irRemoteOf(target);
  if (!remote) return null;

  const colorKeys = remote.keys.filter((k) => k.kind === 'color' && k.rgb);
  const brighter = remote.keys.find((k) => k.kind === 'brighter');
  const dimmer = remote.keys.find((k) => k.kind === 'dimmer');
  const effects = remote.keys.filter((k) => k.kind === 'effect' && USEFUL_EFFECTS.includes(k.id));
  const slower = remote.keys.find((k) => k.id === 'slow');
  const faster = remote.keys.find((k) => k.id === 'quick');

  const press = (key: IrKey): void => {
    pressIrKey(target, key)
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message));
  };
  const same = (a?: Rgb, b?: Rgb): boolean => !!a && !!b && a.r === b.r && a.g === b.g && a.b === b.b;

  return (
    <View style={{ gap: space.md }}>
      {colorKeys.length > 0 && (
        <>
          <Muted>{t('Couleur')}</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xs }}>
            {colorKeys.map((k) => (
              <View key={k.id} style={{ width: '20%', alignItems: 'center' }}>
                <Swatch label={t(k.label)} rgb={k.rgb!} selected={same(k.rgb, target.state?.rgb)} onPress={() => press(k)} />
              </View>
            ))}
          </View>
        </>
      )}

      {(brighter || dimmer) && (
        <>
          <Muted>{t('Luminosité')}</Muted>
          <View style={kit.row}>
            {dimmer && <Pill label={t('☀ Moins')} onPress={() => press(dimmer)} />}
            {brighter && <Pill label={t('☀ Plus')} onPress={() => press(brighter)} />}
          </View>
        </>
      )}

      {effects.length > 0 && (
        <>
          <Muted>{t('Effets')}</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {effects.map((k) => {
              const active = target.state?.effect === k.id;
              return (
                <Pressable
                  key={k.id}
                  onPress={() => press(k)}
                  style={({ pressed }) => ({
                    width: '31.5%',
                    paddingVertical: space.md,
                    alignItems: 'center',
                    gap: space.xs,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.border,
                  })}
                >
                  <EffectDot stops={effectPreview(k)} />
                  <Text style={[kit.muted, { color: active ? colors.accent : colors.text }]}>{t(k.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      {(slower || faster) && (
        <>
          <Muted>{t('Vitesse des effets')}</Muted>
          <View style={kit.row}>
            {slower && <Pill label={t('Plus lent')} onPress={() => press(slower)} />}
            {faster && <Pill label={t('Plus rapide')} onPress={() => press(faster)} />}
          </View>
        </>
      )}
      <Muted>{irAimHint()}</Muted>
      {error && <Text style={[kit.muted, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 52,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.surface : colors.surfaceHigh,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <Text style={[kit.text, { fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}
