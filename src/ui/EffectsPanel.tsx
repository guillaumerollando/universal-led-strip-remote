import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { ElkEffect } from '../core/elk';
import { effectsFor, setEffect, setSpeed, type Target } from '../services/control';
import { Muted, styles as kit } from './kit';
import { colors, radius, rgbCss, space } from './theme';
import { t } from '../i18n';

/** Petite pastille qui joue l'effet en boucle, pour le reconnaître avant de l'envoyer. */
function EffectPreview({ effect }: { effect: ElkEffect }) {
  const t = useSharedValue(0);
  const stops = effect.preview.map((c) => rgbCss(c));
  const input = stops.map((_, i) => i / Math.max(1, stops.length - 1));
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 900 * stops.length, easing: Easing.linear }), -1, true);
  }, [t, stops.length]);
  const style = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.value, input, stops) }));
  return <Animated.View style={[{ width: 34, height: 34, borderRadius: 17 }, style]} />;
}

const SPEEDS = [
  { label: t('Lent'), value: 20 },
  { label: t('Moyen'), value: 55 },
  { label: t('Rapide'), value: 90 },
];

/** Effets dynamiques intégrés au contrôleur, et leur vitesse. */
export function EffectsPanel({ target }: { target: Target }) {
  const [error, setError] = useState<string | null>(null);
  const effects = effectsFor(target);
  if (effects.length === 0) return null;

  const run = (p: Promise<void>): void => {
    p.then(() => setError(null)).catch((e: Error) => setError(e.message));
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {effects.map((e) => {
          const active = target.state?.effect === e.id;
          return (
            <Pressable
              key={e.id}
              onPress={() => run(setEffect(target, e))}
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
              <EffectPreview effect={e} />
              <Text style={[kit.muted, { color: active ? colors.accent : colors.text, textAlign: 'center' }]} numberOfLines={2}>
                {t(e.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Muted>{t('Vitesse')}</Muted>
      <View style={kit.row}>
        {SPEEDS.map((s) => {
          const active = target.state?.speed === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => run(setSpeed(target, s.value))}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceHigh,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              <Text style={[kit.text, { fontWeight: '700', color: active ? colors.accent : colors.text }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error && <Text style={[kit.muted, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}
