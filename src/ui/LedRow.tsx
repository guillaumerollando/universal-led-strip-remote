import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { Rgb } from '../core/elk';
import { Glow } from './light';
import { colors, rgbCss } from './theme';

export type LedMode = 'chase' | 'breathe' | 'lit' | 'off';

const RAINBOW = ['#FF3B3B', '#FF9F1C', '#FFE14D', '#4CE07A', '#3FC9FF', '#6B7BFF', '#C25BFF', '#FF3B3B'];
const STOPS = RAINBOW.map((_, i) => i / (RAINBOW.length - 1));

function Led({ index, count, t, mode, rgb, size }: { index: number; count: number; t: SharedValue<number>; mode: LedMode; rgb: Rgb; size: number }) {
  const lit = rgbCss(rgb);
  const style = useAnimatedStyle(() => {
    if (mode === 'chase') {
      const phase = (t.value + index / count) % 1;
      // Une « tête » plus brillante qui parcourt la rangée.
      const head = (t.value * count) % count;
      const dist = Math.min(Math.abs(head - index), count - Math.abs(head - index));
      return {
        backgroundColor: interpolateColor(phase, STOPS, RAINBOW),
        opacity: Math.max(0.35, 1 - dist * 0.18),
        transform: [{ scale: dist < 1 ? 1.25 : 1 }],
      };
    }
    if (mode === 'breathe') return { backgroundColor: lit, opacity: 0.35 + 0.5 * t.value, transform: [{ scale: 1 }] };
    if (mode === 'lit') return { backgroundColor: lit, opacity: 1, transform: [{ scale: 1.1 }] };
    return { backgroundColor: colors.off, opacity: 1, transform: [{ scale: 1 }] };
  });
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
}

/**
 * Une rangée de LED animée, l'emblème de l'assistant : défile en arc-en-ciel pendant les envois,
 * respire pendant les questions, s'illumine quand c'est gagné.
 */
export function LedRow({ mode, rgb = { r: 255, g: 181, b: 71 }, count = 9, size = 22 }: { mode: LedMode; rgb?: Rgb; count?: number; size?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    if (mode === 'chase') t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    else if (mode === 'breathe') t.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [mode, t]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: size * 2 }}>
      {mode === 'lit' && <Glow rgb={rgb} intensity={0.55} style={{ top: -size, bottom: -size, left: -size * 2, right: -size * 2 }} />}
      <View style={{ flexDirection: 'row', gap: size * 0.55 }}>
        {Array.from({ length: count }, (_, i) => (
          <Led key={i} index={i} count={count} t={t} mode={mode} rgb={rgb} size={size} />
        ))}
      </View>
    </View>
  );
}
