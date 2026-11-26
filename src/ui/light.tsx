import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Mask, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

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

/** Mélange une couleur vers le blanc (0 = inchangée, 1 = blanc) : le cœur brûlant d'une LED. */
const toWhite = ({ r, g, b }: Rgb, k: number): Rgb => ({ r: r + (255 - r) * k, g: g + (255 - g) * k, b: b + (255 - b) * k });

/**
 * Bande de lumière diffuse : uniforme sur la longueur, s'éteignant vers le haut, le bas et les deux bouts
 * (dégradé vertical × masque horizontal). Elle éclaire le fond autour du ruban.
 */
function Bloom({ rgb, intensity, id }: { rgb: Rgb; intensity: number; id: string }) {
  const c = rgbCss(rgb);
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <SvgLinearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c} stopOpacity={0} />
          <Stop offset="0.3" stopColor={c} stopOpacity={intensity * 0.22} />
          <Stop offset="0.5" stopColor={c} stopOpacity={intensity} />
          <Stop offset="0.7" stopColor={c} stopOpacity={intensity * 0.22} />
          <Stop offset="1" stopColor={c} stopOpacity={0} />
        </SvgLinearGradient>
        <SvgLinearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fff" stopOpacity={0} />
          <Stop offset="0.12" stopColor="#fff" stopOpacity={1} />
          <Stop offset="0.88" stopColor="#fff" stopOpacity={1} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </SvgLinearGradient>
        <Mask id={`${id}m`}>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}h)`} />
        </Mask>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}v)`} mask={`url(#${id}m)`} />
    </Svg>
  );
}

/** Rangée de LED dessinées sur le ruban : points brillants allumé, puces mates éteint. */
function LedDots({ height, on, id }: { height: number; on: boolean; id: string }) {
  const step = Math.max(6, height * 1.7);
  const r = Math.max(1.2, height * 0.26);
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id={`${id}p`} x="0" y="0" width={step} height={height} patternUnits="userSpaceOnUse">
          <Circle cx={step / 2} cy={height / 2} r={r} fill={on ? '#fff' : '#3A3F4C'} fillOpacity={on ? 0.55 : 1} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}p)`} />
    </Svg>
  );
}

/**
 * Le ruban lui-même. Allumé : un cœur presque blanc, des LED qui brillent, une lueur serrée (bloom) et un halo
 * large qui respire doucement, et un reflet qui parcourt la bande en éclairant le fond sur son passage
 * (le halo déborde un peu plus vers le bas : la lumière qui tombe sur la surface). Éteint : un trait mat aux LED grises.
 * Seules l'opacité et la position s'animent (thread UI, sans re-rendu) ; rien ne bouge si l'animation est réduite.
 */
export function LightStrip({ on, rgb, height = 8 }: { on: boolean; rgb?: Rgb; height?: number }) {
  const color = rgb ?? WARM_WHITE;
  const reduced = useReducedMotion();
  const shimmer = useSharedValue(0);
  const breath = useSharedValue(1);
  const id = `ls${height}${color.r}-${color.g}-${color.b}`;

  useEffect(() => {
    if (!on || reduced) {
      shimmer.value = 0.5;
      breath.value = 1;
      return;
    }
    shimmer.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }), -1, true);
    breath.value = withRepeat(withTiming(0.72, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [on, reduced, shimmer, breath]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-60 + shimmer.value * 160}%` }],
    opacity: on && !reduced ? 0.55 : 0,
  }));
  // La tache de lumière qui suit le reflet : elle éclaire le fond autour de la partie la plus brillante.
  const spotStyle = useAnimatedStyle(() => ({ left: `${-10 + shimmer.value * 80}%`, opacity: on && !reduced ? 0.9 : 0 }));
  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.value }));

  const box = height * 3.5;
  return (
    <View style={{ height: box, justifyContent: 'center' }}>
      {on && (
        <>
          {/* Halo large, qui respire. */}
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -space.lg, right: -space.lg, top: -height * 2.5, bottom: -height * 3.2 }, breathStyle]}>
            <Glow rgb={color} intensity={0.4} />
          </Animated.View>
          {/* Bloom serré le long de la bande. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: -height, right: -height, top: box / 2 - height * 2, height: height * 4 }}>
            <Bloom rgb={color} intensity={0.7} id={id} />
          </View>
          {/* Tache de lumière qui suit le reflet. */}
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: '40%', top: -height * 1.5, bottom: -height * 1.5 }, spotStyle]}>
            <Glow rgb={toWhite(color, 0.35)} intensity={0.35} />
          </Animated.View>
        </>
      )}
      <View style={{ height, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: on ? rgbCss(color) : colors.off }}>
        {on && (
          <LinearGradient
            colors={[rgbCss(color), rgbCss(toWhite(color, 0.7)), rgbCss(color)]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LedDots height={height} on={on} id={id} />
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

const RAINBOW = ['#FF5A5A', '#FFB547', '#FFF07A', '#5BD68A', '#4FC3FF', '#9B7BFF', '#FF5AC8'];
/** Deux tours d'arc-en-ciel bout à bout : en glissant d'une moitié, la boucle est invisible. */
const RAINBOW_LOOP = [...RAINBOW, ...RAINBOW, RAINBOW[0]];
const BG_CLEAR = rgbCss({ r: 10, g: 11, b: 15 }, 0);

/** L'arc-en-ciel qui défile (200 % de large, décalé d'une moitié par tour). */
function RainbowRun({ style }: { style: object }) {
  return (
    <Animated.View style={[{ width: '200%', height: '100%' }, style]}>
      <LinearGradient colors={RAINBOW_LOOP as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/**
 * La signature de l'appli : un fin ruban arc-en-ciel qui défile, avec sa lumière — un cœur blanc brûlant,
 * une lueur colorée qui déborde autour et respire, et un reflet diffus sur le fond, sous le ruban.
 * Le halo est estompé par des dégradés couleur du fond (`colors.bg`) : à poser sur le fond de l'écran.
 * `children` (le titre) se dessine par-dessus le halo.
 */
export function SignatureStrip({ children }: { children?: ReactNode }) {
  const reduced = useReducedMotion();
  const run = useSharedValue(0);
  const breath = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    run.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false);
    breath.value = withRepeat(withTiming(0.65, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [run, breath, reduced]);
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: `${-50 + run.value * 50}%` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: breath.value }));

  const fade = (stops: string[], locations: number[], horizontal?: boolean) => (
    <LinearGradient
      colors={stops as [string, string, ...string[]]}
      locations={locations as [number, number, ...number[]]}
      start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
      end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );

  return (
    <View>
      {/* Halo : lueur autour du ruban (au-dessus et en dessous) et reflet plus large sur le fond. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -space.lg, right: -space.lg, bottom: -44, height: 72, overflow: 'hidden' }}>
        <Animated.View style={[StyleSheet.absoluteFill, glow]}>
          <RainbowRun style={move} />
        </Animated.View>
        {fade([colors.bg, BG_CLEAR, BG_CLEAR, rgbCss({ r: 10, g: 11, b: 15 }, 0.55), colors.bg], [0, 0.36, 0.42, 0.62, 1])}
        {fade([colors.bg, BG_CLEAR, BG_CLEAR, colors.bg], [0, 0.18, 0.82, 1], true)}
      </View>
      {children}
      <View style={{ height: 4, borderRadius: 2, overflow: 'hidden', marginTop: space.xs }}>
        <RainbowRun style={move} />
        {/* Cœur blanc : la lumière la plus intense, au centre de la bande. */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 1.5, height: 1, backgroundColor: 'rgba(255,255,255,0.55)' }} />
      </View>
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
