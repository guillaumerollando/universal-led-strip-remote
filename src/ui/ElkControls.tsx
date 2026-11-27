import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hsvToRgb, rgbToHsv } from '../core/color';
import type { Rgb } from '../core/elk';
import { canColor, canDim, latestWins, previewColor, setBrightness, setColor, type Target } from '../services/control';
import { ColorSlider, HUE_STOPS } from './ColorSlider';
import { Muted, styles as kit } from './kit';
import { Swatch } from './light';
import { colors, radius, space } from './theme';
import { LoadingBorder, SelectionGlow } from './LoadingBorder';
import { t } from '../i18n';

const SWATCHES: { rgb: Rgb; label: string }[] = [
  { rgb: { r: 255, g: 196, b: 120 }, label: t('Blanc chaud') },
  { rgb: { r: 255, g: 255, b: 255 }, label: t('Blanc') },
  { rgb: { r: 255, g: 0, b: 0 }, label: t('Rouge') },
  { rgb: { r: 255, g: 96, b: 0 }, label: t('Orange') },
  { rgb: { r: 255, g: 200, b: 0 }, label: t('Jaune') },
  { rgb: { r: 0, g: 255, b: 0 }, label: t('Vert') },
  { rgb: { r: 0, g: 220, b: 255 }, label: t('Cyan') },
  { rgb: { r: 0, g: 0, b: 255 }, label: t('Bleu') },
  { rgb: { r: 160, g: 0, b: 255 }, label: t('Violet') },
  { rgb: { r: 255, g: 0, b: 140 }, label: t('Rose') },
];
const LEVELS = [10, 25, 50, 75, 100];
/** À l'arrondi près : la couleur du nuancier repasse par teinte / blancheur (quelques unités d'écart). */
const same = (a?: Rgb, b?: Rgb): boolean =>
  !!a && !!b && Math.abs(a.r - b.r) <= 3 && Math.abs(a.g - b.g) <= 3 && Math.abs(a.b - b.b) <= 3;

/** Couleur et luminosité d'un ruban Bluetooth ou Wi-Fi (chaque partie seulement si l'appareil la gère). */
export function ElkControls({ target }: { target: Target }) {
  const [error, setError] = useState<string | null>(null);
  /** Ce qui est en cours d'envoi : une pastille, un curseur, un niveau de luminosité (contour qui tourne). */
  const [sending, setSending] = useState<string | null>(null);
  const start = rgbToHsv(target.state?.rgb ?? { r: 255, g: 0, b: 0 });
  const [hue, setHue] = useState(start.h);
  const [white, setWhite] = useState(1 - start.s);
  const preview = useMemo(() => latestWins((rgb: Rgb) => previewColor(target, rgb)), [target.key]);
  const pure = hsvToRgb({ h: hue, s: 1, v: 1 });
  const current = hsvToRgb({ h: hue, s: 1 - white, v: 1 });

  const slide = (h: number, w: number): void => {
    setHue(h);
    setWhite(w);
    preview(hsvToRgb({ h, s: 1 - w, v: 1 }));
  };
  const commit = (h: number, w: number, which: string): void => run(setColor(target, hsvToRgb({ h, s: 1 - w, v: 1 })), which);
  const pick = (rgb: Rgb, which: string): void => {
    const hsv = rgbToHsv(rgb);
    setHue(hsv.h);
    setWhite(1 - hsv.s);
    run(setColor(target, rgb), which);
  };

  const run = (action: Promise<void>, which?: string): void => {
    if (which) setSending(which);
    action
      .finally(() => setSending((cur) => (cur === which ? null : cur)))
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message));
  };

  const color = canColor(target);
  return (
    <View style={{ gap: space.md }}>
      {color && (
        <>
          <Muted>{t('Couleur')}</Muted>
          <ColorSlider
            label={t('Teinte')}
            stops={HUE_STOPS}
            value={hue / 360}
            thumbColor={pure}
            onChange={(v) => slide(v * 360, white)}
            onRelease={(v) => commit(v * 360, white, 'hue')}
            busy={sending === 'hue'}
          />
          <ColorSlider
            label={t('Blancheur')}
            stops={[`rgb(${pure.r},${pure.g},${pure.b})`, '#FFFFFF']}
            value={white}
            thumbColor={current}
            onChange={(v) => slide(hue, v)}
            onRelease={(v) => commit(hue, v, 'white')}
            busy={sending === 'white'}
          />
          <Muted>{t('Couleurs rapides')}</Muted>
          <View style={ctl.swatches}>
            {SWATCHES.map((s) => (
              <View key={s.label} style={{ width: '20%', alignItems: 'center' }}>
                {/* La pastille suit la couleur du nuancier en direct (pas la dernière enregistrée, qui ne change qu'au
                    lâcher du doigt) ; rien d'allumé quand un effet ou une ambiance tourne. */}
                <Swatch label={s.label} rgb={s.rgb} selected={!target.state?.effect && same(s.rgb, current)} onPress={() => pick(s.rgb, s.label)} busy={sending === s.label} />
              </View>
            ))}
          </View>
        </>
      )}
      {canDim(target) && (
        <>
          <Muted>{t('Luminosité')}</Muted>
          <View style={kit.row}>
            {LEVELS.map((p) => {
              const active = target.state?.brightness === p;
              return (
                <View key={p} style={{ flex: 1 }}>
                  <Pressable onPress={() => run(setBrightness(target, p), `level${p}`)} style={[ctl.level, active && ctl.levelActive]}>
                    <View style={[ctl.levelFill, { height: `${p}%` }]} />
                    <Text style={[kit.text, { fontWeight: '700' }]}>{p} %</Text>
                  </Pressable>
                  {/* Hors du bouton (qui coupe ce qui dépasse) : la lueur peut déborder. */}
                  <SelectionGlow active={active} radius={radius.sm} outset={0} />
                  <LoadingBorder active={sending === `level${p}`} selected={active} radius={radius.sm} outset={0} />
                </View>
              );
            })}
          </View>
        </>
      )}
      {error && <Text style={[kit.muted, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

const ctl = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xs },
  level: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelActive: { borderColor: colors.accent },
  levelFill: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,181,71,0.22)' },
});
