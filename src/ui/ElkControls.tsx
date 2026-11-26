import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hsvToRgb, rgbToHsv } from '../core/color';
import type { Rgb } from '../core/elk';
import { latestWins, previewColor, setBrightness, setColor, type Target } from '../services/control';
import { ColorSlider, HUE_STOPS } from './ColorSlider';
import { Muted, styles as kit } from './kit';
import { Swatch } from './light';
import { colors, radius, space } from './theme';
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
const same = (a?: Rgb, b?: Rgb): boolean => !!a && !!b && a.r === b.r && a.g === b.g && a.b === b.b;

/** Couleur et luminosité d'un contrôleur ELK-BLEDOM, sans passer par son appli. */
export function ElkControls({ target }: { target: Target }) {
  const [error, setError] = useState<string | null>(null);
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
  const commit = (h: number, w: number): void => run(setColor(target, hsvToRgb({ h, s: 1 - w, v: 1 })));
  const pick = (rgb: Rgb): void => {
    const hsv = rgbToHsv(rgb);
    setHue(hsv.h);
    setWhite(1 - hsv.s);
    run(setColor(target, rgb));
  };

  const run = (action: Promise<void>): void => {
    action
      .then(() => setError(null))
      .catch((e: Error) =>
        setError(`${e.message}. ${t('Rapproche-toi du ruban et ferme ses autres applis.')}`),
      );
  };

  return (
    <View style={{ gap: space.md }}>
      <Muted>{t('Couleur')}</Muted>
      <ColorSlider
        label={t('Teinte')}
        stops={HUE_STOPS}
        value={hue / 360}
        thumbColor={pure}
        onChange={(v) => slide(v * 360, white)}
        onRelease={(v) => commit(v * 360, white)}
      />
      <ColorSlider
        label={t('Blancheur')}
        stops={[`rgb(${pure.r},${pure.g},${pure.b})`, '#FFFFFF']}
        value={white}
        thumbColor={current}
        onChange={(v) => slide(hue, v)}
        onRelease={(v) => commit(hue, v)}
      />
      <Muted>{t('Couleurs rapides')}</Muted>
      <View style={ctl.swatches}>
        {SWATCHES.map((s) => (
          <View key={s.label} style={{ width: '20%', alignItems: 'center' }}>
            <Swatch label={s.label} rgb={s.rgb} selected={same(s.rgb, target.state?.rgb)} onPress={() => pick(s.rgb)} />
          </View>
        ))}
      </View>
      <Muted>{t('Luminosité')}</Muted>
      <View style={kit.row}>
        {LEVELS.map((p) => {
          const active = target.state?.brightness === p;
          return (
            <Pressable key={p} onPress={() => run(setBrightness(target, p))} style={[ctl.level, active && ctl.levelActive]}>
              <View style={[ctl.levelFill, { height: `${p}%` }]} />
              <Text style={[kit.text, { fontWeight: '700' }]}>{p} %</Text>
            </Pressable>
          );
        })}
      </View>
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
