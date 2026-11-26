import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { removeDevice, updateDevice, type SavedDevice } from '../services/store';
import { RoomPicker } from './RoomPicker';
import { RenameField, Sheet } from './Sheet';
import { t } from '../i18n';

/** Réglages d'un ruban (appui long sur sa tuile, ou « ⋯ » sur sa fiche) : nom, pièce, oublier. */
export function DeviceOptions({ device, visible, onClose, onForgotten }: { device: SavedDevice; visible: boolean; onClose: () => void; onForgotten?: () => void }) {
  const [mode, setMode] = useState<'menu' | 'rename' | 'room'>('menu');
  useEffect(() => {
    if (visible) setMode('menu');
  }, [visible]);

  const forget = (): void => {
    onClose();
    Alert.alert(t('Oublier cet appareil ?'), device.name, [
      { text: t('Annuler'), style: 'cancel' },
      {
        text: t('Oublier'),
        style: 'destructive',
        onPress: () => {
          void removeDevice(device.key);
          onForgotten?.();
        },
      },
    ]);
  };

  return (
    <Sheet
      visible={visible}
      title={device.name}
      onClose={onClose}
      items={[
        { label: t('Renommer'), onPress: () => setMode('rename') },
        { label: t('Changer de pièce'), onPress: () => setMode('room') },
        { label: t('Oublier ce ruban'), onPress: forget, danger: true },
      ]}
    >
      {mode === 'rename' ? (
        <RenameField
          initial={device.name}
          onDone={(name) => {
            void updateDevice(device.key, { name });
            onClose();
          }}
        />
      ) : mode === 'room' ? (
        <RoomPicker
          value={device.roomId}
          onChange={(roomId) => {
            void updateDevice(device.key, { roomId });
            onClose();
          }}
        />
      ) : undefined}
    </Sheet>
  );
}
