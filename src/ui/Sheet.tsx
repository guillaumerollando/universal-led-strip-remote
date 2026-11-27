import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, styles } from './kit';
import { colors, radius, space } from './theme';
import { t } from '../i18n';

export interface SheetItem {
  label: string;
  onPress: () => void;
  danger?: boolean;
}

/**
 * Menu qui monte du bas de l'écran (appui long sur une pièce ou un ruban, comme Google Home).
 * `children` remplace la liste quand une action demande une saisie (renommer, changer de pièce).
 */
export function Sheet({ visible, title, items, onClose, children }: { visible: boolean; title: string; items: SheetItem[]; onClose: () => void; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (visible) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel={t('Fermer')} onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.lg,
            gap: space.xs,
          }}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.sm }} />
          <Text style={[styles.title, { marginBottom: space.sm }]} numberOfLines={1}>
            {title}
          </Text>
          {children ??
            items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={item.onPress}
                style={({ pressed }) => ({ minHeight: 52, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.sm, backgroundColor: pressed ? colors.surfaceHigh : 'transparent' })}
              >
                <Text style={[styles.text, { fontSize: 17, color: item.danger ? colors.danger : colors.text }]}>{item.label}</Text>
              </Pressable>
            ))}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Saisie d'un nouveau nom, dans un `Sheet`. */
export function RenameField({ initial, onDone, taken }: { initial: string; onDone: (name: string) => void; taken?: (name: string) => boolean }) {
  const [name, setName] = useState(initial);
  const clash = !!name.trim() && !!taken?.(name);
  const done = (): void => {
    if (name.trim() && !clash) onDone(name.trim());
  };
  return (
    <View style={{ gap: space.md }}>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={done}
        placeholderTextColor={colors.textDim}
      />
      {clash && <Text style={[styles.muted, { color: colors.warn }]}>{t('Une autre pièce porte déjà ce nom.')}</Text>}
      <Button label={t('Renommer')} onPress={done} disabled={!name.trim() || clash} />
    </View>
  );
}
