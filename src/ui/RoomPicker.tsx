import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { addRoom, useRooms } from '../services/store';
import { styles } from './kit';
import { Chip } from './light';
import { colors } from './theme';
import { t } from '../i18n';

/** Choisir la pièce d'un ruban, ou en créer une sur place. `undefined` = sans pièce. */
export function RoomPicker({ value, onChange }: { value?: string; onChange: (roomId: string | undefined) => void }) {
  const rooms = useRooms();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = async (): Promise<void> => {
    if (!name.trim()) return;
    const room = await addRoom(name);
    onChange(room.id);
    setName('');
    setCreating(false);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Chip label={t('Aucune')} selected={!value} onPress={() => onChange(undefined)} />
        {rooms.map((r) => (
          <Chip key={r.id} label={r.name} selected={value === r.id} onPress={() => onChange(r.id)} />
        ))}
        {!creating && <Chip label={t('+ Nouvelle pièce')} onPress={() => setCreating(true)} />}
      </View>
      {creating && (
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('Nom de la pièce (ex. Salon)')}
          placeholderTextColor={colors.textDim}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void create()}
          onBlur={() => void create()}
        />
      )}
    </View>
  );
}
