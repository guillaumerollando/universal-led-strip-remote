import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Rgb } from '../core/elk';
import { colors, radius, rgbCss, space, WARM_WHITE } from './theme';

/** Halo de lumière diffuse (dégradé radial), posé derrière un élément. */
export function Glow({ rgb, intensity = 0.55, style }: { rgb: Rgb; intensity?: number; style?: ViewStyle }) {
  const id = `g${rgb.r}-${rgb.g}-${rgb.b}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={rgbCss(rgb)} stopOpacity={intensity} />
            <Stop offset="0.55" stopColor={rgbCss(rgb)} stopOpacity={intensity * 0.25} />
            <Stop offset="1" stopColor={rgbCss(rgb)} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * Le ruban lui-même : une barre lumineuse de la couleur du ruban, avec un reflet qui la parcourt
 * lentement quand il est allumé. Éteint, c'est un trait gris mat.
 */
export function LightStrip({ on, rgb, height = 8 }: { on: boolean; rgb?: Rgb; height?: number }) {
  const color = rgb ?? WARM_WHITE;
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = on ? withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }), -1, true) : 0;
  }, [on, shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-60 + shimmer.value * 160}%` }],
    opacity: on ? 0.55 : 0,
  }));

  return (
    <View style={{ height: height * 3.5, justifyContent: 'center' }}>
      {on && <Glow rgb={color} intensity={0.5} style={{ left: -space.lg, right: -space.lg }} />}
      <View
        style={{
          height,
          borderRadius: radius.pill,
          overflow: 'hidden',
          backgroundColor: on ? rgbCss(color) : colors.off,
        }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { width: '45%' }, shimmerStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

/** Bouton marche/arrêt rond ; à l'allumage, une bouffée de lumière s'en échappe. */
export function PowerButton({
  on,
  rgb,
  onPress,
  size = 52,
  busy,
  label,
  onLongPress,
}: {
  on: boolean;
  rgb?: Rgb;
  onPress: () => void;
  size?: number;
  busy?: boolean;
  label: string;
  /** Appui long : corriger l'état retenu sans rien envoyer (télécommandes à touche unique). */
  onLongPress?: () => void;
}) {
  const color = rgb ?? WARM_WHITE;
  const bloom = useSharedValue(0);
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: (1 - bloom.value) * 0.6,
    transform: [{ scale: 1 + bloom.value * 1.8 }],
  }));

  const press = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!on) bloom.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, busy }}
      accessibilityLabel={label}
      onPress={press}
      onLongPress={
        onLongPress &&
        (() => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onLongPress();
        })
      }
      disabled={busy}
      hitSlop={8}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: rgbCss(color) },
          bloomStyle,
        ]}
      />
      {on && <Glow rgb={color} intensity={0.6} style={{ margin: -size * 0.45 }} />}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: on ? rgbCss(color) : colors.surfaceHigh,
          borderWidth: 1,
          borderColor: on ? rgbCss(color) : colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.5 : 1,
        }}
      >
        <PowerIcon color={on ? (luminance(color) > 150 ? colors.bg : colors.text) : colors.textDim} size={size * 0.42} />
      </View>
    </Pressable>
  );
}

/** Pictogramme marche/arrêt dessiné (le caractère ⏻ manque aux polices Android). */
function PowerIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          width: size,
          height: size * 0.88,
          borderRadius: size,
          borderWidth: 2.2,
          borderColor: color,
          borderTopColor: 'transparent',
        }}
      />
      <View style={{ width: 2.4, height: size * 0.5, borderRadius: 2, backgroundColor: color }} />
    </View>
  );
}

export const luminance = ({ r, g, b }: Rgb): number => r * 0.3 + g * 0.59 + b * 0.11;

/**
 * La signature de Rubanix : un fin ruban multicolore qu'une lueur parcourt, sous le titre.
 */
export function SignatureStrip() {
  const run = useSharedValue(0);
  useEffect(() => {
    run.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false);
  }, [run]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: `${-50 + run.value * 50}%` }] }));
  return (
    <View style={{ height: 3, borderRadius: 2, overflow: 'hidden', marginTop: space.xs, opacity: 0.85 }}>
      <Animated.View style={[{ width: '200%', height: '100%' }, style]}>
        <LinearGradient
          colors={['#FF5A5A', '#FFB547', '#FFF07A', '#5BD68A', '#4FC3FF', '#9B7BFF', '#FF5AC8', '#FF5A5A', '#FFB547', '#FFF07A', '#5BD68A', '#4FC3FF', '#9B7BFF', '#FF5AC8', '#FF5A5A']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Pastille de couleur lumineuse. */
export function Swatch({ rgb, selected, onPress, label }: { rgb: Rgb; selected?: boolean; onPress: () => void; label: string }): ReactNode {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
      {selected && <Glow rgb={rgb} intensity={0.7} style={{ margin: -14 }} />}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: rgbCss(rgb),
          borderWidth: selected ? 3 : 1,
          borderColor: selected ? colors.text : 'rgba(255,255,255,0.15)',
        }}
      />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space.md,
        minHeight: 38,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? 'rgba(255,181,71,0.12)' : colors.surface,
      }}
    >
      <Text style={{ color: selected ? colors.accent : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
