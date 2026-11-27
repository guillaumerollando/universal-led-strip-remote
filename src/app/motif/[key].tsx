import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BUILTIN_AMBIANCES, type Ambiance } from '../../core/ambiances';
import { CELLS, creationBytes, DEFAULTS, encodeCreation, LIMITS, SCRIPT_MAX_BYTES, SNAKE_MAX_LEDS, toFullStrip, type Creation, type CreationStyle, type Size } from '../../core/creations';
import { previewFrame } from '../../core/creationPreview';
import { hsvToRgb, rgbToHsv, saturationToWhite, whiteStops, whiteToSaturation, type Hsv } from '../../core/color';
import type { Rgb } from '../../core/elk';
import { cellAtStrip, fill, gradient, OFF, paintRange, rainbow, resize, sameRgb, STRIP_ROWS, stripCols } from '../../core/motifTools';
import type { MotifMode } from '../../core/protocols/openbeken';
import { saveAmbiance } from '../../services/ambiances';
import { creationOf, motifOf, setCreation, stripLength } from '../../services/control';
import { useSavedDevice } from '../../services/store';
import { ColorSlider, HUE_STOPS } from '../../ui/ColorSlider';
import { Button, Muted, Screen, SectionTitle, styles } from '../../ui/kit';
import { Chip, LightStrip, Swatch } from '../../ui/light';
import { colors, rgbCss, space } from '../../ui/theme';
import { t } from '../../i18n';

const QUICK: { rgb: Rgb; label: string }[] = [
  { rgb: { r: 255, g: 0, b: 0 }, label: t('Rouge') },
  { rgb: { r: 255, g: 96, b: 0 }, label: t('Orange') },
  { rgb: { r: 255, g: 200, b: 0 }, label: t('Jaune') },
  { rgb: { r: 0, g: 255, b: 0 }, label: t('Vert') },
  { rgb: { r: 0, g: 220, b: 255 }, label: t('Cyan') },
  { rgb: { r: 0, g: 0, b: 255 }, label: t('Bleu') },
  { rgb: { r: 160, g: 0, b: 255 }, label: t('Violet') },
  { rgb: { r: 255, g: 0, b: 140 }, label: t('Rose') },
  { rgb: { r: 255, g: 196, b: 120 }, label: t('Blanc chaud') },
  { rgb: OFF, label: t('Éteint') },
];
const MODES: { mode: MotifMode; label: string }[] = [
  { mode: 'still', label: t('Fixe') },
  { mode: 'snake', label: t('Serpent') },
  { mode: 'flow', label: t('Défile') },
];
const SPEEDS = [
  { label: t('Lent'), value: 20 },
  { label: t('Moyen'), value: 55 },
  { label: t('Rapide'), value: 90 },
];
/** LED montrées dans l'aperçu : assez pour voir le motif avancer. */
const PREVIEW = 40;
const lit = (c: Rgb): boolean => c.r + c.g + c.b > 0;

/** Aperçu : la création telle qu'elle tournera sur le ruban, LED pour LED (sa vraie longueur), dessinée comme les
 * rubans du reste de l'appli (bande lumineuse, lueur et halo). */
function CreationPreview({ creation, n }: { creation: Creation; n: number }) {
  const [frame, setFrame] = useState(0);
  // Rien ne bouge en mode « Fixe » ; et l'animation s'arrête quand l'écran est caché (calibrage ouvert par-dessus).
  const animated = !(creation.style === 'motif' && creation.mode === 'still');
  useFocusEffect(
    useCallback(() => {
      if (!animated) return undefined;
      const id = setInterval(() => setFrame((f) => f + 1), 80);
      return () => clearInterval(id);
    }, [animated]),
  );
  return (
    <View accessible={false} style={{ paddingVertical: space.sm, paddingHorizontal: space.sm }}>
      <LightStrip on leds={previewFrame(creation, frame, n)} height={10} />
    </View>
  );
}

const ROW_H = 30;
const ROW_GAP = 14;
/** Place des virages du S de chaque côté (rayon extérieur du demi-tour). */
const TURN = ROW_H + ROW_GAP / 2;
const TUBE = '#15171D';

/**
 * Le ruban à peindre, plié en S comme dans l'appli Tuya : 3 passages (aller, retour, aller) reliés par des virages,
 * du début (▶) à la fin. Chaque case couvre une ou quelques LED ; on glisse le doigt n'importe où, même d'un passage
 * à l'autre, et chaque case survolée prend la couleur.
 */
const PaintS = memo(function PaintS({ pixels, onPaint }: { pixels: Rgb[]; onPaint: (from: number, to: number) => void }) {
  const widthRef = useRef(1);
  const last = useRef(-1);
  const count = useRef(pixels.length);
  count.current = pixels.length;
  const paint = useRef(onPaint);
  paint.current = onPaint;
  const cols = stripCols(pixels.length);
  const rows = Math.min(STRIP_ROWS, Math.ceil(pixels.length / cols));
  const [width, setWidth] = useState(0);
  // Position du doigt dans la toile elle-même (ses dessins ignorent le toucher) : juste dès le premier geste.
  const at = (x: number, y: number): number | null =>
    cellAtStrip(x, y, { width: widthRef.current, rows, cols, rowHeight: ROW_H, gap: ROW_GAP, inset: TURN }, count.current);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const i = at(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (i === null) return;
          last.current = i;
          paint.current(i, i);
          void Haptics.selectionAsync();
        },
        onPanResponderMove: (e) => {
          const i = at(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (i === null || i === last.current) return;
          paint.current(last.current < 0 ? i : last.current, i);
          last.current = i;
          void Haptics.selectionAsync();
        },
        onPanResponderRelease: () => void (last.current = -1),
        onPanResponderTerminate: () => void (last.current = -1),
        // Pendant qu'on peint, la page ne doit pas voler le doigt pour défiler.
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cols],
  );

  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => {
        widthRef.current = Math.max(1, e.nativeEvent.layout.width);
        setWidth(e.nativeEvent.layout.width);
      }}
      accessibilityLabel={t('Ruban à peindre : glisse le doigt pour colorer les LED')}
      style={{ height: rows * ROW_H + (rows - 1) * ROW_GAP }}
    >
      {/* Virages : un demi-tour du tube entre deux passages, à droite puis à gauche. */}
      {width > 0 &&
        Array.from({ length: rows - 1 }, (_, r) => {
          const right = r % 2 === 0;
          return (
            <View
              key={`turn${r}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: r * (ROW_H + ROW_GAP),
                left: right ? width - TURN : 0,
                width: TURN,
                height: 2 * ROW_H + ROW_GAP,
                borderColor: TUBE,
                borderTopWidth: ROW_H,
                borderBottomWidth: ROW_H,
                borderRightWidth: right ? ROW_H : 0,
                borderLeftWidth: right ? 0 : ROW_H,
                borderTopRightRadius: right ? TURN : 0,
                borderBottomRightRadius: right ? TURN : 0,
                borderTopLeftRadius: right ? 0 : TURN,
                borderBottomLeftRadius: right ? 0 : TURN,
              }}
            />
          );
        })}
      {Array.from({ length: rows }, (_, row) => (
        <View
          key={row}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: row * (ROW_H + ROW_GAP),
            left: TURN,
            right: TURN,
            height: ROW_H,
            flexDirection: row % 2 === 0 ? 'row' : 'row-reverse',
            alignItems: 'center',
            paddingHorizontal: 2,
            backgroundColor: TUBE,
          }}
        >
          {Array.from({ length: cols }, (_, col) => {
            const c = pixels[row * cols + col];
            if (!c) return <View key={col} style={{ flex: 1 }} />;
            return (
              <View
                key={col}
                style={{
                  flex: 1,
                  height: ROW_H - 10,
                  marginHorizontal: 1.5,
                  borderRadius: 4,
                  backgroundColor: lit(c) ? rgbCss(c) : colors.off,
                  shadowColor: rgbCss(c),
                  shadowOpacity: lit(c) ? 0.9 : 0,
                  shadowRadius: 6,
                  elevation: lit(c) ? 3 : 0,
                }}
              />
            );
          })}
        </View>
      ))}
      {/* Début du ruban (côté branchement) et fin. */}
      <Text pointerEvents="none" style={{ position: 'absolute', top: (ROW_H - 18) / 2, left: TURN - 16, color: colors.accent, fontSize: 13 }}>
        ▶
      </Text>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: (rows - 1) * (ROW_H + ROW_GAP) + ROW_H / 2 - 3,
          [rows % 2 === 1 ? 'right' : 'left']: TURN - 8,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.textDim,
        }}
      />
    </View>
  );
});

const STYLES: { style: CreationStyle; label: string }[] = [
  { style: 'motif', label: t('Motif') },
  { style: 'bands', label: t('Bandes') },
  { style: 'glows', label: t('Lueurs') },
  { style: 'step', label: t('Guirlande qui avance') },
  { style: 'flicker', label: t('Guirlande qui grésille') },
  { style: 'leaves', label: t('Feuilles qui tombent') },
];
const SIZES: { size: Size; label: string }[] = [
  { size: 'small', label: t('Fines') },
  { size: 'medium', label: t('Moyennes') },
  { size: 'large', label: t('Larges') },
];
/** Le fond n'existe que pour les styles qui ont un ciel derrière leurs couleurs. */
const hasBg = (s: CreationStyle): boolean => s === 'bands' || s === 'glows' || s === 'leaves';
const hasSpeed = (c: Creation): boolean => !(c.style === 'motif' && c.mode === 'still') && c.style !== 'flicker' && c.style !== 'leaves';

/**
 * Créer mon ambiance : choisir un style (ou partir d'une ambiance de l'appli), ses couleurs et quelques réglages ;
 * l'aperçu montre le résultat. Toutes les ambiances de l'appli sont refaisables ici. Le motif se peint du doigt.
 */
export default function CreateScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const device = useSavedDevice(key);
  /** Longueur réelle du ruban (configuration, ou réglée ici) : le motif se dessine sur toutes ses LED. */
  const [n, setN] = useState(() => (device ? stripLength(device) : 100));
  const [creation, setCreationState] = useState<Creation>(() => {
    const running = device && creationOf(device);
    if (running) return toFullStrip(running, n);
    const legacy = device && motifOf(device);
    return toFullStrip(legacy ? { ...DEFAULTS, colors: legacy.pixels, mode: legacy.mode } : DEFAULTS, n);
  });
  /** Couleur en cours : teinte, blancheur (saturation) et luminosité réglables. */
  const [hsv, setHsv] = useState<Hsv>({ h: 0, s: 1, v: 1 });
  /** Dernière création essayée sur le ruban (pour afficher « Sur le ruban »). */
  const [sent, setSent] = useState<string | null>(null);
  // Le pinceau du moment, lu au toucher : la toile n'est pas redessinée à chaque mouvement d'un curseur.
  const brushRef = useRef<Rgb>(hsvToRgb(hsv));
  brushRef.current = hsvToRgb(hsv);
  /** Peint de case en case à partir des couleurs les plus récentes (un glissement rapide n'en saute aucune). */
  const paintCells = useCallback(
    (from: number, to: number) => setCreationState((prev) => ({ ...prev, colors: paintRange(prev.colors, from, to, brushRef.current) })),
    [],
  );
  const bytes = useMemo(() => creationBytes(creation, { n, level: 100 }), [creation, n]);
  const encoded = useMemo(() => encodeCreation(creation), [creation]);
  /** Case de couleur choisie (styles sans dessin) : -1 = le fond. */
  const [slot, setSlot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  // Retour de l'aide au calibrage : le dessin se recale sur la nouvelle longueur.
  const realLength = device ? stripLength(device) : n;
  useEffect(() => {
    if (realLength === n) return;
    setN(realLength);
    setSent(null);
    setCreationState((prev) => toFullStrip(prev, realLength));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realLength]);

  if (!device) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Muted>{t('Cet appareil n’est plus dans la liste. Relance une recherche.')}</Muted>
      </View>
    );
  }

  const c = creation;
  const update = (patch: Partial<Creation>): void => setCreationState((prev) => ({ ...prev, ...patch }));
  const setColors = (colorsNext: Rgb[]): void => update({ colors: colorsNext });
  const drawn = c.style === 'motif' || c.style === 'step';
  const limit = LIMITS[c.style];
  const full = c.style === 'motif';
  const tooBig = bytes > SCRIPT_MAX_BYTES;
  const brush = hsvToRgb(hsv);
  const pure = hsvToRgb({ h: hsv.h, s: 1, v: 1 });
  const onStrip = sent === encoded;

  /** Pose la couleur dans la case choisie (ou le fond) ; pour le dessin, c'est le pinceau. */
  const put = (rgb: Rgb): void => {
    if (drawn) return;
    if (slot < 0) update({ bg: rgb });
    else setColors(c.colors.map((x, i) => (i === slot ? rgb : x)));
  };
  const choose = (rgb: Rgb): void => {
    setHsv(rgbToHsv(rgb));
    put(rgb);
  };
  /** Un curseur bouge : la couleur suit en direct (l'aperçu aussi). */
  const tune = (patch: Partial<Hsv>): void => {
    const next = { ...hsv, ...patch };
    setHsv(next);
    put(hsvToRgb(next));
  };
  const pickSlot = (i: number): void => {
    setSlot(i);
    setHsv(rgbToHsv(i < 0 ? c.bg : (c.colors[i] ?? OFF)));
  };
  const changeStyle = (style: CreationStyle): void => {
    const colorsNext = c.colors.slice(0, style === 'motif' ? n : LIMITS[style].max);
    const next = colorsNext.length > 0 ? colorsNext : DEFAULTS.colors.slice(0, 1);
    setCreationState((prev) => toFullStrip({ ...prev, style, colors: next }, n));
    // La case 1 est choisie : les curseurs prennent sa couleur.
    setSlot(0);
    setHsv(rgbToHsv(next[0] ?? OFF));
  };
  const startFrom = (a: Ambiance): void => {
    if (!a.template) return;
    setCreationState({ ...DEFAULTS, ...a.template, mode: a.template.mode ?? 'flow', cell: a.template.cell ?? 1 });
    setSlot(0);
    setHsv(rgbToHsv(a.template.colors[0] ?? OFF));
  };
  /** Essaie la création sur le ruban, sans quitter l'écran (souhait de Guillaume : voir avant de garder). */
  const tryIt = (): void => {
    setBusy(true);
    setError(null);
    const key = encoded;
    setCreation(device, c)
      .then(() => setSent(key))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  /** Enregistre la création dans « mes ambiances » (sur le téléphone), la met sur le ruban, puis revient. */
  const save = (): void => {
    // Touche du clavier comprise : rien de trop gros pour le ruban, et un seul enregistrement à la fois.
    if (busy || tooBig || !name?.trim()) return;
    setBusy(true);
    saveAmbiance(name, c)
      .then(() => setCreation(device, c))
      .then(() => router.back())
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Screen
      header={
        <>
          <CreationPreview creation={c} n={full ? n : PREVIEW} />
          <Button
            label={onStrip ? t('Sur le ruban ✓') : t('Essayer sur le ruban')}
            variant={onStrip ? 'ghost' : undefined}
            onPress={tryIt}
            busy={busy}
            disabled={tooBig}
          />
        </>
      }
    >
      <SectionTitle>{t('Partir d’une ambiance')}</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {BUILTIN_AMBIANCES.filter((a) => a.template).map((a) => (
          <Chip key={a.id} label={t(a.label)} onPress={() => startFrom(a)} />
        ))}
      </ScrollView>

      <SectionTitle>{t('Style')}</SectionTitle>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {STYLES.map((x) => (
          <Chip key={x.style} label={x.label} selected={c.style === x.style} onPress={() => changeStyle(x.style)} />
        ))}
      </View>

      {drawn ? (
        <>
          <SectionTitle>{t('Peins le ruban')}</SectionTitle>
          <PaintS pixels={c.colors} onPaint={paintCells} />
          <Muted>{t('Choisis une couleur, puis glisse le doigt sur le ruban.')}</Muted>
          {full && <Muted>{t('Le ruban est dessiné plié en S, du début (▶) à la fin.')}</Muted>}
        </>
      ) : (
        <>
          <SectionTitle>{t('Couleurs')}</SectionTitle>
          <View style={[styles.row, { flexWrap: 'wrap', alignItems: 'center' }]}>
            {hasBg(c.style) && (
              <SlotDot label={t('Fond')} rgb={c.bg} selected={slot < 0} onPress={() => pickSlot(-1)} />
            )}
            {c.colors.map((col, i) => (
              <SlotDot key={i} label={String(i + 1)} rgb={col} selected={slot === i} onPress={() => pickSlot(i)} />
            ))}
          </View>
          <Muted>{t('Touche une case, puis une couleur.')}</Muted>
        </>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        {QUICK.map((s) => (
          <Swatch key={s.label} label={s.label} rgb={s.rgb} selected={sameRgb(s.rgb, brush)} onPress={() => choose(s.rgb)} />
        ))}
      </View>
      <ColorSlider
        label={t('Teinte')}
        stops={HUE_STOPS}
        value={hsv.h / 360}
        thumbColor={pure}
        // Depuis « Éteint », choisir une teinte rallume la couleur.
        onChange={(v) => tune({ h: v * 360, v: hsv.v || 1, s: hsv.v ? hsv.s : 1 })}
        onRelease={(v) => tune({ h: v * 360, v: hsv.v || 1, s: hsv.v ? hsv.s : 1 })}
      />
      <ColorSlider
        label={t('Blancheur')}
        stops={whiteStops(hsv.h, hsv.v)}
        value={saturationToWhite(hsv.s)}
        thumbColor={brush}
        onChange={(v) => tune({ s: whiteToSaturation(v) })}
        onRelease={(v) => tune({ s: whiteToSaturation(v) })}
      />
      <ColorSlider
        label={t('Luminosité')}
        stops={['#000000', rgbCss(hsvToRgb({ h: hsv.h, s: hsv.s, v: 1 }))]}
        value={hsv.v}
        thumbColor={brush}
        onChange={(v) => tune({ v })}
        onRelease={(v) => tune({ v })}
      />

      {drawn && (
        <>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <Chip label={t('Tout remplir')} onPress={() => setColors(fill(c.colors.length, brush))} />
            {/* Sur tout le ruban : 40 paliers, assez pour l'œil, et le script reste court. */}
            <Chip label={t('Dégradé')} onPress={() => setColors(gradient(c.colors, 40))} />
            <Chip label={t('Arc-en-ciel')} onPress={() => setColors(rainbow(c.colors.length, Math.min(c.colors.length, 40)))} />
            <Chip label={t('Tout effacer')} onPress={() => setColors(fill(c.colors.length, OFF))} />
          </View>
          <Muted>{t('Dégradé : peins les deux bouts, puis touche « Dégradé ».')}</Muted>
          {!full && (
            <>
              <SectionTitle>{t('Taille des cases')}</SectionTitle>
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                {CELLS.map((k) => (
                  <Chip key={k} label={t('{n} LED', { n: k })} selected={c.cell === k} onPress={() => update({ cell: k })} />
                ))}
              </View>
              <Muted>{t('Chaque case peinte couvre ce nombre de LED, et le dessin se répète tout le long du ruban.')}</Muted>
            </>
          )}
        </>
      )}

      {!full && (
        <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={styles.text}>{drawn ? t('Cases : {n}', { n: c.colors.length }) : t('Couleurs : {n}', { n: c.colors.length })}</Text>
          <View style={styles.row}>
            <Chip label="−" disabled={c.colors.length <= limit.min} onPress={() => setColors(resize(c.colors, c.colors.length - 1))} />
            <Chip label="+" disabled={c.colors.length >= limit.max} onPress={() => setColors(resize(c.colors, c.colors.length + 1))} />
          </View>
        </View>
      )}

      {(c.style === 'bands' || c.style === 'glows') && (
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {SIZES.map((x) => (
            <Chip key={x.size} label={x.label} selected={c.size === x.size} onPress={() => update({ size: x.size })} />
          ))}
        </View>
      )}

      {c.style === 'motif' && (
        <>
          <SectionTitle>{t('Animation')}</SectionTitle>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {MODES.map((m) => (
              <Chip key={m.mode} label={m.label} selected={c.mode === m.mode} onPress={() => update({ mode: m.mode })} />
            ))}
          </View>
          {c.mode === 'snake' && <Muted>{t('Serpent : la partie allumée du dessin parcourt le ruban ({n} LED au plus).', { n: SNAKE_MAX_LEDS })}</Muted>}
        </>
      )}
      {hasSpeed(c) && (
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {SPEEDS.map((s) => (
            <Chip key={s.value} label={s.label} selected={c.speed === s.value} onPress={() => update({ speed: s.value })} />
          ))}
        </View>
      )}

      {tooBig && (
        <Text style={[styles.muted, { color: colors.warn }]}>
          {full ? t('Trop de détails pour le ruban : moins de couleurs différentes.') : t('Trop de détails pour le ruban : moins de couleurs ou des cases plus grandes.')}
        </Text>
      )}
      {name === null ? (
        <Button label={t('Enregistrer dans mes ambiances')} onPress={() => setName('')} disabled={tooBig} />
      ) : (
        <View style={{ gap: space.sm }}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('Nom de l’ambiance (ex. Soirée)')}
            placeholderTextColor={colors.textDim}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Button label={t('Enregistrer et envoyer')} onPress={save} busy={busy} disabled={!name.trim() || tooBig} />
        </View>
      )}
      {error && <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text>}
      <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/calibrate/[key]', params: { key: device.key } })} style={{ paddingVertical: space.md, alignItems: 'center' }}>
        <Text style={[styles.muted, { color: colors.accent }]}>{t('Le dessin ne correspond pas au ruban ?')}</Text>
      </Pressable>
    </Screen>
  );
}

/** Une case de couleur (fond ou couleur n) : on la choisit, puis une couleur de la palette. */
function SlotDot({ label, rgb, selected, onPress }: { label: string; rgb: Rgb; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={{ alignItems: 'center', gap: 2 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: lit(rgb) ? rgbCss(rgb) : colors.off,
          borderWidth: selected ? 3 : 1,
          borderColor: selected ? colors.text : colors.border,
        }}
      />
      <Text style={[styles.muted, { fontSize: 12 }]}>{label}</Text>
    </Pressable>
  );
}
