import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { ElkEffect } from '../core/elk';
import type { CatalogEffect } from '../core/effectCatalog';
import { catalogFor, effectsFor, setEffect, setSpeed, type Target } from '../services/control';
import { toggleFavorite, useFavorites } from '../services/favorites';
import { Muted, styles as kit } from './kit';
import { Sheet } from './Sheet';
import { LoadingBorder, SelectionGlow } from './LoadingBorder';
import { colors, radius, rgbCss, space } from './theme';
import { t } from '../i18n';

/** Petite pastille qui joue l'effet en boucle, pour le reconnaître avant de l'envoyer. */
function EffectPreview({ effect, size = 34 }: { effect: ElkEffect; size?: number }) {
  const t = useSharedValue(0);
  const stops = effect.preview.map((c) => rgbCss(c));
  const input = stops.map((_, i) => i / Math.max(1, stops.length - 1));
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 900 * stops.length, easing: Easing.linear }), -1, true);
  }, [t, stops.length]);
  const style = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.value, input, stops) }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
}

/**
 * Pastille fixe (couleurs de l'effet en parts) pour la longue liste « Tous les effets » : 220 pastilles animées
 * faisaient ramer puis planter l'appli (Guillaume, 2026-11-27).
 */
function StaticPreview({ effect, size }: { effect: ElkEffect; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', flexDirection: 'row' }}>
      {effect.preview.slice(0, 4).map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: rgbCss(c) }} />
      ))}
    </View>
  );
}

/** « Tous les effets » s'affiche par pages, pour rester fluide. */
const PAGE = 24;

const SPEEDS = [
  { label: t('Lent'), value: 20 },
  { label: t('Moyen'), value: 55 },
  { label: t('Rapide'), value: 90 },
];

/** Nom affiché d'un effet : ceux du catalogue sont composés de mots traduits (« Fondu Rouge Vert », « Flot 12 »). */
export function effectName(e: ElkEffect): string {
  const c = e as Partial<CatalogEffect>;
  if (c.parts) return c.parts.map((p) => t(p)).join(' ') + (c.num ? ` ${c.num}` : '');
  return t(e.label);
}
/** Favori d'un effet : par son code dans le contrôleur. */
export const effectFav = (e: ElkEffect): string => `fx:${e.code}`;

/**
 * Effets intégrés au contrôleur, et leur vitesse. Quelques-uns choisis d'abord ; « Tous les effets » (replié) donne
 * accès à tout le catalogue pour les bidouilleurs. Appui long : favori. `favoritesOnly` : seulement les favoris (en
 * tête de la fiche).
 */
export function EffectsPanel({ target, favoritesOnly }: { target: Target; favoritesOnly?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [menu, setMenu] = useState<ElkEffect | null>(null);
  /** Effet en cours d'envoi : un rond qui tourne, pour voir que le ruban va suivre. */
  const [sending, setSending] = useState<string | null>(null);
  const [speedSending, setSpeedSending] = useState<number | null>(null);
  const favs = useFavorites();
  const effects = effectsFor(target);
  const catalog = catalogFor(target);
  if (effects.length === 0 && catalog.length === 0) return null;

  const run = (p: Promise<void>): void => {
    p.then(() => setError(null)).catch((e: Error) => setError(e.message));
  };
  const known = [...effects, ...catalog];
  const favorites = favs.map((k) => known.find((e) => effectFav(e) === k)).filter((e): e is ElkEffect => !!e);
  if (favoritesOnly && favorites.length === 0) return null;

  const tile = (e: ElkEffect, small: boolean) => {
    const active = target.state?.effect === e.id;
    const fav = favs.includes(effectFav(e));
    return (
      <Pressable
        key={e.id}
        onPress={() => {
          if (sending) return;
          setSending(e.id);
          run(setEffect(target, e).finally(() => setSending(null)));
        }}
        onLongPress={() => setMenu(e)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityHint={t('Appui long : réglages')}
        style={({ pressed }) => ({
          width: small ? '23.5%' : '31.5%',
          paddingVertical: small ? space.sm : space.md,
          alignItems: 'center',
          gap: space.xs,
          borderRadius: radius.md,
          backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.accent : colors.border,
        })}
      >
        {small ? <StaticPreview effect={e} size={22} /> : <EffectPreview effect={e} size={34} />}
        <Text style={[kit.muted, { color: active ? colors.accent : colors.text, textAlign: 'center', fontSize: small ? 12 : undefined }]} numberOfLines={2}>
          {fav && !favoritesOnly ? '★ ' : ''}
          {effectName(e)}
        </Text>
        <SelectionGlow active={active} radius={radius.md} />
        <LoadingBorder active={sending === e.id} selected={active} radius={radius.md} />
      </Pressable>
    );
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{(favoritesOnly ? favorites : effects).map((e) => tile(e, false))}</View>
      {!favoritesOnly && catalog.length > 0 && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: all }}
            onPress={() => {
              setAll((v) => !v);
              setShown(PAGE);
            }}
            style={{ paddingVertical: space.sm, alignItems: 'center' }}
          >
            <Text style={[kit.text, { color: colors.accent, fontWeight: '600' }]}>
              {all ? t('Masquer les effets') : t('Tous les effets ({n})', { n: catalog.length })}
            </Text>
          </Pressable>
          {all && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>{catalog.slice(0, shown).map((e) => tile(e, true))}</View>}
          {all && shown < catalog.length && (
            <Pressable accessibilityRole="button" onPress={() => setShown((k) => k + PAGE)} style={{ paddingVertical: space.sm, alignItems: 'center' }}>
              <Text style={[kit.text, { color: colors.accent }]}>{t('Afficher plus ({n} restants)', { n: catalog.length - shown })}</Text>
            </Pressable>
          )}
        </>
      )}
      {!favoritesOnly && (
        <>
          <Muted>{t('Vitesse')}</Muted>
          <View style={kit.row}>
            {SPEEDS.map((s) => {
              // Rien de choisi : les effets partent à « Moyen » (55 %), c'est donc lui qui est allumé.
              const active = (target.state?.speed ?? 55) === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => {
                    if (speedSending !== null) return;
                    setSpeedSending(s.value);
                    run(setSpeed(target, s.value).finally(() => setSpeedSending(null)));
                  }}
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
                  <SelectionGlow active={active} radius={radius.pill} />
                  <LoadingBorder active={speedSending === s.value} selected={active} radius={radius.pill} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      {error && <Text style={[kit.muted, { color: colors.danger }]}>{error}</Text>}
      <Sheet
        visible={menu !== null}
        title={menu ? effectName(menu) : ''}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                {
                  label: favs.includes(effectFav(menu)) ? t('Retirer des favoris') : t('Ajouter aux favoris'),
                  onPress: () => {
                    void toggleFavorite(effectFav(menu));
                    setMenu(null);
                  },
                },
              ]
            : []
        }
      />
    </View>
  );
}
