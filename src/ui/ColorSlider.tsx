import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';

import type { Rgb } from '../core/elk';
import { Glow } from './light';
import { colors, radius, rgbCss } from './theme';

const HEIGHT = 40;
const THUMB = 34;

/**
 * Barre de dégradé qu'on fait glisser du doigt (teinte, blancheur…).
 * `value` va de 0 à 1 ; `onChange` est appelé pendant le glissement, `onRelease` au lâcher.
 */
export function ColorSlider({
  stops,
  value,
  thumbColor,
  onChange,
  onRelease,
  label,
}: {
  stops: string[];
  value: number;
  thumbColor: Rgb;
  onChange: (v: number) => void;
  onRelease: (v: number) => void;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const last = useRef(value);
  const handlers = useRef({ onChange, onRelease });
  handlers.current = { onChange, onRelease };

  const responder = useMemo(() => {
    const at = (x: number): number => {
      const w = widthRef.current;
      return w > 0 ? Math.max(0, Math.min(1, (x - THUMB / 2) / (w - THUMB))) : 0;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Le défilement vertical de l'écran ne doit pas voler le geste une fois commencé.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        last.current = at(e.nativeEvent.locationX);
        handlers.current.onChange(last.current);
      },
      onPanResponderMove: (e) => {
        last.current = at(e.nativeEvent.locationX);
        handlers.current.onChange(last.current);
      },
      onPanResponderRelease: () => handlers.current.onRelease(last.current),
      onPanResponderTerminate: () => handlers.current.onRelease(last.current),
    });
  }, []);

  const onLayout = (e: LayoutChangeEvent): void => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const left = value * Math.max(0, width - THUMB);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      onLayout={onLayout}
      style={{ height: THUMB + 8, justifyContent: 'center' }}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={{ height: HEIGHT, borderRadius: radius.pill, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <LinearGradient colors={stops as [string, string, ...string[]]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left, width: THUMB, height: THUMB, alignItems: 'center', justifyContent: 'center' }}>
        <Glow rgb={thumbColor} intensity={0.7} style={{ margin: -16 }} />
        <View
          style={{
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: rgbCss(thumbColor),
            borderWidth: 3,
            borderColor: colors.text,
          }}
        />
      </View>
    </View>
  );
}

/** Les couleurs de l'arc-en-ciel, pour le dégradé de teinte. */
export const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];
