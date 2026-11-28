import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { addRoom, roomNamed, useRooms, type Room } from '../services/store';
import { Button, styles } from './kit';
import { Chip } from './light';
import { colors, radius, space } from './theme';
import { t } from '../i18n';

/**
 * Choisir la pièce d'un ruban, ou en créer une. « + Nouvelle pièce » ouvre une petite fenêtre avec un bouton
 * « Créer » : la pièce n'existe qu'une fois ce bouton touché, et elle est aussitôt choisie. `undefined` = sans pièce.
 */
export function RoomPicker({ value, onChange }: { value?: string; onChange: (roomId: string | undefined) => void }) {
  const rooms = useRooms();
  const [creating, setCreating] = useState(false);

  return (
    <View style={[styles.row, { flexWrap: 'wrap' }]}>
      <Chip label={t('Aucune')} selected={!value} onPress={() => onChange(undefined)} />
      {rooms.map((r) => (
        <Chip key={r.id} label={r.name} selected={value === r.id} onPress={() => onChange(r.id)} />
      ))}
      <Chip label={t('+ Nouvelle pièce')} onPress={() => setCreating(true)} />
      <NewRoomDialog
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(room) => {
          setCreating(false);
          onChange(room.id);
        }}
      />
    </View>
  );
}

/** Petite fenêtre « Nouvelle pièce » : un nom, « Créer ». Un nom déjà pris choisit la pièce existante. */
function NewRoomDialog({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (room: Room) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const existing = name.trim() ? roomNamed(name) : undefined;

  const close = (): void => {
    setName('');
    onClose();
  };
  const create = async (): Promise<void> => {
    if (busy || !name.trim()) return;
    setBusy(true);
    const room = await addRoom(name);
    setBusy(false);
    setName('');
    onCreated(room);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'center', padding: space.lg }}>
        <Pressable accessibilityLabel={t('Fermer')} onPress={close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md }}>
          <Text style={styles.title}>{t('Nouvelle pièce')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('Nom de la pièce (ex. Salon)')}
            placeholderTextColor={colors.textDim}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void create()}
          />
          {!!existing && <Text style={styles.muted}>{t('« {name} » existe déjà : la lumière y sera rangée.', { name: existing.name })}</Text>}
          <View style={[styles.row, { gap: space.sm }]}>
            <Button label={t('Annuler')} variant="secondary" onPress={close} style={{ flex: 1 }} />
            <Button label={existing ? t('Choisir') : t('Créer')} onPress={() => void create()} disabled={!name.trim()} busy={busy} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
