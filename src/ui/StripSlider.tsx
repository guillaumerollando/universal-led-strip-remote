import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';

import type { Rgb } from '../core/elk';
import { latestWins, previewBrightness, setBrightness, type Target } from '../services/control';
import { LightStrip } from './light';
import { t } from '../i18n';

const STEP = 5;
const MIN = 5;
const snap = (fraction: number): number => Math.max(MIN, Math.min(100, Math.round((fraction * 100) / STEP) * STEP));

/**
 * Le ruban dessiné sert de curseur : on glisse le doigt le long du ruban, ses LED s'allument jusqu'au doigt
 * et le vrai ruban suit. Un simple toucher reste un toucher (ouvre ses commandes), l'appui long ses réglages.
 * Accessible : TalkBack le présente comme un réglage (balayer vers le haut / bas = ± 10 %).
 */
export function StripSlider({
  target,
  on,
  rgb,
  onTap,
  onLongPress,
  onError,
  height = 6,
}: {
  target: Target;
  on: boolean;
  rgb?: Rgb;
  onTap: () => void;
  onLongPress: () => void;
  /** Le ruban n'a pas répondu : le curseur revient à la valeur connue, la tuile dit pourquoi. */
  onError?: (message: string | null) => void;
  height?: number;
}) {
  const saved = target.state?.brightness ?? 100;
  const [drag, setDrag] = useState<number | null>(null);
  const width = useRef(1);
  const start = useRef(0);
  const dragging = useRef(false);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longDone = useRef(false);
  const live = useMemo(() => latestWins((p: number) => previewBrightness(target, p)), [target.key]);
  const level = drag ?? saved;
  const ref = useRef({ saved, onTap, onLongPress, onError, target });
  ref.current = { saved, onTap, onLongPress, onError, target };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragging.current = false;
          longDone.current = false;
          start.current = ref.current.saved;
          longTimer.current = setTimeout(() => {
            longDone.current = true;
            ref.current.onLongPress();
          }, 500);
        },
        onPanResponderMove: (_, g) => {
          if (!dragging.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy)) {
            dragging.current = true;
            if (longTimer.current) clearTimeout(longTimer.current);
            void Haptics.selectionAsync();
          }
          if (!dragging.current) return;
          const next = snap(start.current / 100 + g.dx / width.current);
          setDrag((prev) => {
            if (prev !== next) {
              if (next === 100 || next === MIN) void Haptics.selectionAsync();
              live(next);
            }
            return next;
          });
        },
        onPanResponderRelease: (_, g) => {
          if (longTimer.current) clearTimeout(longTimer.current);
          if (dragging.current) {
            const final = snap(start.current / 100 + g.dx / width.current);
            setBrightness(ref.current.target, final)
              .then(() => ref.current.onError?.(null))
              .catch((e: Error) => ref.current.onError?.(e.message))
              .finally(() => setDrag(null));
          } else if (!longDone.current) ref.current.onTap();
        },
        onPanResponderTerminate: () => {
          if (longTimer.current) clearTimeout(longTimer.current);
          setDrag(null);
        },
        // Pendant un glissement horizontal, la liste ne doit pas voler le doigt pour défiler.
        onPanResponderTerminationRequest: () => !dragging.current,
      }),
    [live],
  );

  const adjust = (delta: number): void => {
    setBrightness(target, snap((saved + delta) / 100)).catch((e: Error) => onError?.(e.message));
  };

  return (
    <View
      {...responder.panHandlers}
      onLayout={(e: LayoutChangeEvent) => (width.current = Math.max(1, e.nativeEvent.layout.width))}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('Luminosité')}
      accessibilityValue={{ min: 0, max: 100, now: level, text: `${level} %` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => adjust(e.nativeEvent.actionName === 'increment' ? 10 : -10)}
      hitSlop={{ top: 10, bottom: 10 }}
    >
      <LightStrip on={on} rgb={rgb} height={height} level={level / 100} />
    </View>
  );
}
