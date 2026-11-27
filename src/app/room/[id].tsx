import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { addRoom, removeRoom, renameRoom, roomNamed, updateDevice, useRooms, useSavedDevices } from '../../services/store';
import { Button, Muted, Screen, SectionTitle, styles } from '../../ui/kit';
import { kindLabel } from '../../ui/labels';
import { colors, radius, space } from '../../ui/theme';
import { t } from '../../i18n';

/** Créer ou modifier une pièce : son nom et les rubans qu'elle contient. */
export default function RoomScreen() {
  const { id, device } = useLocalSearchParams<{ id: string; device?: string }>();
  const rooms = useRooms();
  const devices = useSavedDevices();
  // Après création, on reste sur cet écran : il passe en mode édition de la pièce créée
  // (une redirection vers la même route ne rafraîchissait pas l'écran).
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const room = rooms.find((r) => r.id === (createdId ?? id));
  const isNew = id === 'new' && !createdId;
  const [name, setName] = useState(room?.name ?? '');
  // Jamais deux pièces du même nom (« Salon » et « salon » comptent pour une).
  const clash = name.trim() ? roomNamed(name, room?.id) : undefined;

  if (!isNew && !room) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Muted>{t('Cette pièce n’existe plus.')}</Muted>
      </View>
    );
  }

  const create = async (): Promise<void> => {
    if (creating || !name.trim() || clash) return;
    setCreating(true);
    const created = await addRoom(name);
    if (device) {
      // Créée depuis la fiche d'un ruban : on y retourne, le ruban est déjà rangé dans la pièce.
      await updateDevice(device, { roomId: created.id });
      router.back();
      return;
    }
    setCreatedId(created.id);
    setCreating(false);
  };

  const remove = (): void =>
    Alert.alert(t('Supprimer « {name} » ?', { name: room?.name ?? '' }), t('Les lumières restent, elles passent dans « Sans pièce ».'), [
      { text: t('Annuler'), style: 'cancel' },
      {
        text: t('Supprimer'),
        style: 'destructive',
        onPress: () => {
          if (room) void removeRoom(room.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? t('Nouvelle pièce') : (room?.name ?? t('Pièce')) }} />
      {createdId && <Muted>{t('Pièce créée. Coche maintenant les lumières qu’elle contient.')}</Muted>}
      <SectionTitle>{t('Nom')}</SectionTitle>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('Ex. Salon')}
        placeholderTextColor={colors.textDim}
        autoFocus={isNew}
        returnKeyType="done"
        // Mêmes conditions que les boutons (pas de nom vide ni en double depuis la touche du clavier).
        onSubmitEditing={() => {
          if (!name.trim() || clash) return;
          if (isNew) void create();
          else if (room && name.trim() !== room.name) void renameRoom(room.id, name);
        }}
      />
      {!!clash && <Muted>{t('Une autre pièce porte déjà ce nom.')}</Muted>}
      {isNew ? (
        <Button label={t('Créer la pièce')} onPress={() => void create()} disabled={!name.trim() || !!clash} busy={creating} />
      ) : (
        <Button label={t('Renommer')} variant="secondary" onPress={() => room && void renameRoom(room.id, name)} disabled={!name.trim() || name.trim() === room?.name || !!clash} />
      )}

      {room && (
        <>
          <SectionTitle>{t('Lumières de la pièce')}</SectionTitle>
          {devices.length === 0 && <Muted>{t('Ajoute d’abord des lumières depuis l’accueil.')}</Muted>}
          {devices.map((d) => {
            const inRoom = d.roomId === room.id;
            const elsewhere = d.roomId && !inRoom ? rooms.find((r) => r.id === d.roomId)?.name : undefined;
            return (
              <Pressable
                key={d.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: inRoom }}
                onPress={() => void updateDevice(d.key, { roomId: inRoom ? undefined : room.id })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: inRoom ? colors.accent : colors.border,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    borderWidth: 2,
                    borderColor: inRoom ? colors.accent : colors.textDim,
                    backgroundColor: inRoom ? colors.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {inRoom && <Text style={{ color: colors.accentText, fontWeight: '900' }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{d.name}</Text>
                  <Muted>
                    {kindLabel(d)}
                    {elsewhere ? t(' · actuellement : {room}', { room: elsewhere }) : ''}
                  </Muted>
                </View>
              </Pressable>
            );
          })}
          {createdId && <Button label={t('Terminé')} onPress={() => router.back()} />}
          <Button label={t('Supprimer la pièce')} variant="ghost" onPress={remove} />
        </>
      )}
    </Screen>
  );
}
