import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Muted, styles } from './kit';
import { RoomPicker } from './RoomPicker';
import { colors, space } from './theme';
import { t } from '../i18n';

/**
 * Dernière étape d'un ajout (Bluetooth ou télécommande) : un nom déjà proposé, une pièce, et le bouton
 * « Ajouter à mes rubans » toujours visible en bas de l'écran, au-dessus du clavier.
 */
export function AddForm({
  top,
  name,
  onName,
  roomId,
  onRoom,
  onSave,
  saving,
}: {
  /** Le haut de l'écran : la lumière, le titre, un éventuel test. */
  top: ReactNode;
  name: string;
  onName: (name: string) => void;
  roomId?: string;
  onRoom: (roomId: string | undefined) => void;
  onSave: () => void;
  saving?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Pressable accessibilityLabel={t('Fermer')} hitSlop={16} onPress={() => router.back()} style={{ alignSelf: 'flex-start' }}>
          <Text style={[styles.title, { color: colors.textDim, fontSize: 26 }]}>✕</Text>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: space.lg }]} keyboardShouldPersistTaps="handled">
        {top}
        <Muted>{t('Nom')}</Muted>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={onName}
          placeholder={t('Ex. Néon du salon')}
          placeholderTextColor={colors.textDim}
          selectTextOnFocus
          returnKeyType="done"
        />
        <Muted>{t('Dans quelle pièce ?')}</Muted>
        <RoomPicker value={roomId} onChange={onRoom} />
      </ScrollView>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.lg, backgroundColor: colors.bg }}>
        <Button label={t('Ajouter à mes lumières')} onPress={onSave} disabled={!name.trim()} busy={saving} style={{ minHeight: 56 }} />
      </View>
    </KeyboardAvoidingView>
  );
}
