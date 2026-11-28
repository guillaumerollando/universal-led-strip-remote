import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { captureScene, type RoomScene } from '../core/scenes';
import { canPower } from '../services/control';
import { favoritesFirst, sceneFav, toggleFavorite, useFavorites } from '../services/favorites';
import { pinWidget } from '../services/pinWidget';
import { applyScene, markApplied, useActiveScene, hasHiddenPresets, hidePreset, presetItems, removeScene, restorePresets, saveScene, usePresetsOf, useRoomScenes } from '../services/scenes';
import type { Room, SavedDevice } from '../services/store';
import { styles as kit } from './kit';
import { RenameField, Sheet } from './Sheet';
import { LoadingBorder, SelectionGlow } from './LoadingBorder';
import { colors, radius, space } from './theme';
import { t } from '../i18n';
import { showDialog } from './Dialog';

function SceneChip({
  label,
  busy,
  selected,
  onPress,
  onLongPress,
  accent,
}: {
  label: string;
  busy?: boolean;
  /** La pièce est dans cette ambiance : contour orange et sa lueur. */
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        paddingHorizontal: space.md,
        minHeight: 38,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
        borderColor: accent || selected ? colors.accent : colors.border,
      })}
    >
      <Text style={{ color: accent || selected ? colors.accent : colors.text, fontWeight: '600' }}>{label}</Text>
      <SelectionGlow active={!!selected} radius={radius.pill} />
      {/* Pendant l'envoi, le contour devient un petit ruban de lumière qui tourne. */}
      <LoadingBorder active={!!busy} selected={selected} radius={radius.pill} />
    </Pressable>
  );
}

/**
 * Les ambiances d'une pièce, sous son nom : un toucher règle tous ses rubans d'un coup (Bluetooth, Wi-Fi et
 * infrarouge). « ＋ Retenir » garde la pièce telle qu'elle est ; appui long sur une ambiance retenue pour l'oublier.
 */
export function SceneRow({ room, devices }: { room: Room; devices: SavedDevice[] }) {
  const mine = useRoomScenes(room.id);
  const presets = usePresetsOf(room.id);
  const favs = useFavorites();
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  /** Ambiance dont on a ouvert le menu (appui long) : la poser en widget, ou l'oublier si elle est retenue. */
  const [menu, setMenu] = useState<{ id: string; name: string; mine?: RoomScene } | null>(null);
  const controllable = devices.filter(canPower);
  const current = useActiveScene(room.id, devices);
  if (controllable.length === 0) return null;

  const run = (id: string, items: Parameters<typeof applyScene>[0]): void => {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(id);
    setReport(null);
    applyScene(items)
      .then((r) => {
        // La pièce est maintenant « dans » cette ambiance : sa pastille s'entoure d'orange.
        if (r.failed.length < items.length) markApplied(room.id, id, devices.map((d) => d.key));
        if (r.failed.length > 0) {
          const names = r.failed.map((f) => devices.find((d) => d.key === f.key)?.name ?? f.key);
          setReport(t('Pas de réponse : {names}', { names: names.join(', ') }));
        }
      })
      .finally(() => setBusy(null));
  };
  const forget = (s: RoomScene): void => {
    showDialog(t('Supprimer « {name} » ?', { name: s.name }), undefined, [
      { text: t('Annuler'), style: 'cancel' },
      { text: t('Supprimer'), style: 'destructive', onPress: () => void removeScene(s.id) },
    ]);
  };

  return (
    <View style={{ gap: space.xs }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>
        {/* Les favorites d'abord (★), puis les autres ; mêmes gestes pour celles de l'appli et les retenues. */}
        {favoritesFirst(
          [
            ...mine.map((m) => ({ id: m.id, label: m.name, items: () => m.items, mine: m as RoomScene | undefined })),
            ...presets.map((p) => ({ id: p.id, label: t(p.name), items: () => presetItems(p, devices), mine: undefined })),
          ],
          (x) => sceneFav(x.id),
          favs,
        ).map((x) => (
          <SceneChip
            key={x.id}
            label={(favs.includes(sceneFav(x.id)) ? '★ ' : '') + x.label}
            busy={busy === x.id}
            selected={current === x.id}
            onPress={() => run(x.id, x.items())}
            onLongPress={() => setMenu({ id: x.id, name: x.label, mine: x.mine })}
          />
        ))}
        <SceneChip label={t('＋ Retenir')} accent onPress={() => setNaming(true)} />
        {/* Toutes les ambiances proposées retirées : de quoi les remettre (sinon, appui long sur une ambiance). */}
        {presets.length === 0 && hasHiddenPresets(room.id) && (
          <SceneChip label={t('Remettre les ambiances proposées')} onPress={() => void restorePresets(room.id)} />
        )}
      </ScrollView>
      {report && <Text style={[kit.muted, { color: colors.danger }]}>{report}</Text>}
      <Sheet
        visible={menu !== null}
        title={menu ? `${menu.name} · ${room.name}` : ''}
        onClose={() => setMenu(null)}
        items={[
          {
            label: menu && favs.includes(sceneFav(menu.id)) ? t('Retirer des favoris') : t('Ajouter aux favoris'),
            onPress: () => {
              if (menu) void toggleFavorite(sceneFav(menu.id));
              setMenu(null);
            },
          },
          {
            label: t('Ajouter à l’écran d’accueil'),
            onPress: () => {
              if (menu) pinWidget('ambiance', room.id, menu.id);
              setMenu(null);
            },
          },
          ...(menu && !menu.mine
            ? [
                {
                  label: t('Ne plus proposer'),
                  onPress: () => {
                    void hidePreset(room.id, menu.id);
                    setMenu(null);
                  },
                },
              ]
            : []),
          ...(hasHiddenPresets(room.id)
            ? [
                {
                  label: t('Remettre les ambiances proposées'),
                  onPress: () => {
                    void restorePresets(room.id);
                    setMenu(null);
                  },
                },
              ]
            : []),
          ...(menu?.mine
            ? [
                {
                  label: t('Oublier cette ambiance'),
                  danger: true,
                  onPress: () => {
                    const s = menu.mine!;
                    setMenu(null);
                    forget(s);
                  },
                },
              ]
            : []),
        ]}
      />
      <Sheet visible={naming} title={t('Retenir l’ambiance de la pièce')} items={[]} onClose={() => setNaming(false)}>
        <Text style={kit.muted}>{t('Règle tes lumières comme tu aimes, puis donne un nom : un toucher la remettra.')}</Text>
        <RenameField
          initial=""
          placeholder={t('Nom de l’ambiance (ex. Soirée)')}
          action={t('Retenir')}
          takenMessage={t('Une ambiance de cette pièce porte déjà ce nom.')}
          taken={(n) => mine.some((s) => s.name.trim().toLowerCase() === n.trim().toLowerCase())}
          onDone={(n) => {
            void saveScene(captureScene(room.id, n, controllable));
            setNaming(false);
          }}
        />
      </Sheet>
    </View>
  );
}
