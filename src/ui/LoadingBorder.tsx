import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { colors } from './theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
/**
 * Calque posé sur le bord de la case : un enfant en position absolue se place à l'intérieur de la bordure ;
 * `outset` (épaisseur de la bordure, 1 par défaut) le ramène pile sur le contour. 0 : parent sans bordure.
 */
const edge = (outset: number) => ({ position: 'absolute' as const, top: -outset, left: -outset, right: -outset, bottom: -outset });
/** Tronçons de la traîne : assez pour un fondu sans marches. */
const SEGMENTS = 12;
const TAIL = 0.42;
const TURN_MS = 1100;

type Geometry = { w: number; h: number; r: number; perimeter: number };

/** Un tronçon de la traîne : même trait que le contour de sélection, de moins en moins opaque vers la queue. */
function Segment({ g, i, progress, appear, fill }: { g: Geometry; i: number; progress: SharedValue<number>; appear: SharedValue<number>; fill: SharedValue<number> }) {
  const len = (g.perimeter * TAIL) / SEGMENTS;
  const fade = (1 - i / SEGMENTS) ** 1.6;
  const props = useAnimatedProps(() => ({
    strokeDashoffset: -(progress.value * g.perimeter) + i * len,
    strokeOpacity: fade * appear.value * (1 - fill.value),
  }));
  return (
    <AnimatedRect
      x={0.5}
      y={0.5}
      width={g.w}
      height={g.h}
      rx={g.r}
      fill="none"
      stroke={colors.accent}
      strokeWidth={1}
      strokeDasharray={[len + 0.6, Math.max(1, g.perimeter - len - 0.6)]}
      animatedProps={props}
    />
  );
}

/**
 * Pendant l'envoi au ruban, le contour de la case (même orange, même trait que la sélection) tourne comme un
 * serpent dont la queue s'efface. Il apparaît en fondu ; à la fin, il se fond dans le contour plein si la case est
 * désormais choisie, sinon il s'efface (Guillaume, 2026-11-27 : « ultra fluide », « aspect premium »). Posé
 * par-dessus la case : la mise en page ne bouge pas. Animation réduite : rien de plus que la sélection.
 */
export function LoadingBorder({ active, selected, radius, outset = 1 }: { active: boolean; selected?: boolean; radius: number; outset?: number }) {
  const [shown, setShown] = useState(active);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const progress = useSharedValue(0);
  const appear = useSharedValue(0);
  const fill = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    // Rien à faire tant qu'on n'a jamais tourné (cases au repos : aucune animation lancée).
    if (reduced || (!active && !shown)) return;
    if (active) {
      setShown(true);
      fill.value = 0;
      appear.value = 0;
      appear.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      progress.value = 0;
      progress.value = withRepeat(withTiming(1, { duration: TURN_MS, easing: Easing.linear }), -1, false);
      return;
    }
    const done = (finished?: boolean): void => {
      'worklet';
      if (finished) {
        cancelAnimation(progress);
        runOnJS(setShown)(false);
      }
    };
    // Choisie : la traîne se fond dans le contour plein (déjà dessiné dessous). Sinon : elle s'efface.
    if (selected) fill.value = withTiming(1, { duration: 320, easing: Easing.inOut(Easing.quad) }, done);
    else appear.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }, done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced]);

  const fullProps = useAnimatedProps(() => ({ strokeOpacity: fill.value * appear.value }));

  if (!shown || reduced) return null;
  const w = Math.max(0, size.w - 1);
  const h = Math.max(0, size.h - 1);
  const r = Math.max(0, Math.min(radius - 0.5, h / 2, w / 2));
  const g: Geometry = { w, h, r, perimeter: 2 * (w + h) - (8 - 2 * Math.PI) * r };
  return (
    <View pointerEvents="none" style={edge(outset)} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <AnimatedRect x={0.5} y={0.5} width={w} height={h} rx={r} fill="none" stroke={colors.accent} strokeWidth={1} animatedProps={fullProps} />
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <Segment key={i} g={g} i={i} progress={progress} appear={appear} fill={fill} />
          ))}
        </Svg>
      )}
    </View>
  );
}

/**
 * Petite lueur autour d'un contour orange de sélection (la DA « la lumière d'abord ») : deux traits orange très
 * légers qui débordent de part et d'autre du contour, apparus en fondu. Posée par-dessus la case.
 */
export function SelectionGlow({ active, radius, outset = 1 }: { active: boolean; radius: number; outset?: number }) {
  // Montée seulement à la première sélection : les dizaines de cases jamais choisies ne coûtent rien.
  const [used, setUsed] = useState(active);
  useEffect(() => {
    if (active) setUsed(true);
  }, [active]);
  return used ? <Glow active={active} radius={radius} outset={outset} /> : null;
}

function Glow({ active, radius, outset }: { active: boolean; radius: number; outset: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: 260, easing: Easing.out(Easing.quad) });
  }, [active, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const PAD = 4;
  const w = size.w + 2 * PAD;
  const h = size.h + 2 * PAD;
  const rect = (inset: number, width: number, alpha: number) => (
    <Rect
      x={PAD - inset + 0.5}
      y={PAD - inset + 0.5}
      width={Math.max(0, size.w - 1 + 2 * inset)}
      height={Math.max(0, size.h - 1 + 2 * inset)}
      rx={Math.max(0, Math.min(radius + inset, (size.h + 2 * inset) / 2))}
      fill="none"
      stroke={colors.accent}
      strokeOpacity={alpha}
      strokeWidth={width}
    />
  );
  return (
    <View pointerEvents="none" style={edge(outset)} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 && (
        <Animated.View style={[{ position: 'absolute', left: -PAD, top: -PAD, width: w, height: h }, style]}>
          <Svg width={w} height={h}>
            {rect(0, 6, 0.1)}
            {rect(0, 3, 0.18)}
            {rect(1.5, 1, 0.22)}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
