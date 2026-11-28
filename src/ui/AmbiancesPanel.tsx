import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ambianceColors, BUILTIN_AMBIANCES, type Ambiance } from '../core/ambiances';
import { removeAmbiance, useMyAmbiances } from '../services/ambiances';
import { ambianceFav, toggleFavorite, useFavorites } from '../services/favorites';
import { Sheet } from './Sheet';
import { LoadingBorder, SelectionGlow } from './LoadingBorder';
import { ambianceRunning, ambiancesFor, canMotif, creationOf, setAmbiance, setCreation, type Target } from '../services/control';
import { encodeCreation } from '../core/creations';
import { Button, styles as kit } from './kit';
import { colors, radius, rgbCss, space } from './theme';
import { t } from '../i18n';
import { showDialog } from './Dialog';

/** Les couleurs de l'ambiance en petite rangée de LED (fond éteint pour un serpent). */
function MotifDots({ ambiance, count = 8 }: { ambiance: Pick<Ambiance, 'motif' | 'colors'>; count?: number }) {
  const colorsOf = ambianceColors(ambiance);
  const snake = ambiance.motif?.mode === 'snake';
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: count }, (_, i) => {
        const c = colorsOf.length === 0 ? undefined : snake ? colorsOf[i] : colorsOf[i % colorsOf.length];
        const lit = c && c.r + c.g + c.b > 0;
        return <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: lit ? rgbCss(c) : colors.off }} />;
      })}
    </View>
  );
}

/**
 * Ambiances d'un ruban à pixels : quelques-unes livrées avec l'appli, et celles que l'utilisateur a enregistrées.
 * Un toucher l'envoie au ruban ; elle tourne ensuite toute seule. Appui long : la mettre en favori (ou l'oublier si
 * c'est la sienne). `favoritesOnly` : seulement les favorites, en tête de la fiche du ruban.
 */
export function AmbiancesPanel({ target, favoritesOnly }: { target: Target; favoritesOnly?: boolean }) {
  const mine = useMyAmbiances();
  const favs = useFavorites();
  const [menu, setMenu] = useState<Ambiance | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = creationOf(target);
  const isActive = (a: Ambiance): boolean =>
    a.creation ? !!current && encodeCreation(current) === encodeCreation(a.creation) : ambianceRunning(target) === a.id;

  /** Une ambiance de l'appli est jouée par le ruban ; une ambiance de l'utilisateur est sa création. */
  const send = (a: Ambiance): Promise<void> => (a.creation ? setCreation(target, a.creation) : setAmbiance(target, a.id));

  const apply = (a: Ambiance): void => {
    // Un envoi à la fois : le ruban ne prend qu'une connexion, et un second toucher ne ferait que l'embrouiller.
    if (busy) return;
    setBusy(a.id);
    send(a)
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(null));
  };
  const forget = (a: Ambiance): void => {
    showDialog(t('Supprimer « {name} » ?', { name: a.label }), undefined, [
      { text: t('Annuler'), style: 'cancel' },
      { text: t('Supprimer'), style: 'destructive', onPress: () => void removeAmbiance(a.id) },
    ]);
  };

  // Celles que ce ruban sait jouer ; les motifs dessinés seulement sur un ruban qui sait les faire défiler.
  const playable = ambiancesFor(target);
  const drawable = canMotif(target);
  const all = [...BUILTIN_AMBIANCES.filter((a) => playable.includes(a.id)), ...(drawable ? mine : [])];
  const shown = favoritesOnly
    ? favs.map((k) => all.find((a) => ambianceFav(a.id) === k)).filter((a): a is Ambiance => !!a)
    : all;
  if (favoritesOnly && shown.length === 0) return null;
  const name = (a: Ambiance): string => (a.mine ? a.label : t(a.label));

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {shown.map((a) => {
          const active = isActive(a);
          const fav = favs.includes(ambianceFav(a.id));
          return (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active, busy: busy === a.id }}
              onPress={() => apply(a)}
              onLongPress={() => setMenu(a)}
              accessibilityHint={t('Appui long : réglages')}
              style={({ pressed }) => ({
                width: '48.5%',
                padding: space.md,
                gap: space.sm,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              })}
            >
              <MotifDots ambiance={a} />
              <Text style={[kit.text, { fontWeight: '600', color: active ? colors.accent : colors.text }]} numberOfLines={1}>
                {fav && !favoritesOnly ? '★ ' : ''}
                {name(a)}
              </Text>
              {/* Pendant l'envoi, le contour devient un petit ruban de lumière qui tourne. */}
              <SelectionGlow active={active} radius={radius.md} />
              <LoadingBorder active={busy === a.id} selected={active} radius={radius.md} />
            </Pressable>
          );
        })}
      </View>
      {!favoritesOnly && drawable && (
        <Button
          label={t('Créer mon ambiance')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/motif/[key]', params: { key: target.key } })}
        />
      )}
      {error && <Text style={[kit.muted, { color: colors.danger }]}>{error}</Text>}
      <Sheet
        visible={menu !== null}
        title={menu ? name(menu) : ''}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                {
                  label: favs.includes(ambianceFav(menu.id)) ? t('Retirer des favoris') : t('Ajouter aux favoris'),
                  onPress: () => {
                    void toggleFavorite(ambianceFav(menu.id));
                    setMenu(null);
                  },
                },
                ...(menu.mine
                  ? [
                      {
                        label: t('Oublier cette ambiance'),
                        danger: true,
                        onPress: () => {
                          const a = menu;
                          setMenu(null);
                          forget(a);
                        },
                      },
                    ]
                  : []),
              ]
            : []
        }
      />
    </View>
  );
}
