import { useSyncExternalStore } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, styles } from './kit';
import { colors, radius, space } from './theme';
import { t } from '../i18n';

/**
 * Fenêtres de l'appli, à son style (Guillaume, 2026-11-28 : « les pop-up purement Android, ça fait kitsch ») : à la
 * place d'`Alert.alert`, même forme d'appel. Une seule à la fois ; toucher à côté = le bouton « Annuler » s'il y en a un.
 */
export interface DialogButton {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let current: DialogState | null = null;
const listeners = new Set<() => void>();
const set = (next: DialogState | null): void => {
  current = next;
  listeners.forEach((l) => l());
};

/** Ouvre une fenêtre : titre, petite phrase, boutons (« Compris » seul par défaut). */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  set({ title, message, buttons: buttons?.length ? buttons : [{ text: t('Compris') }] });
}

/** À poser une fois, à la racine de l'appli. */
export function DialogHost() {
  const dialog = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  const press = (b?: DialogButton): void => {
    set(null);
    b?.onPress?.();
  };
  const cancel = (): void => press(dialog?.buttons.find((b) => b.style === 'cancel'));

  return (
    <Modal visible={!!dialog} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={cancel}>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.lg }}>
        <Pressable accessibilityLabel={t('Fermer')} onPress={cancel} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        {dialog && (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: space.lg,
              gap: space.md,
              // Une petite lueur ambrée, comme les cases choisies de l'appli.
              shadowColor: colors.accent,
              shadowOpacity: 0.25,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <Text style={[styles.title, { fontSize: 19 }]}>{dialog.title}</Text>
            {!!dialog.message && <Text style={[styles.text, { color: colors.textDim, lineHeight: 21 }]}>{dialog.message}</Text>}
            <View style={[styles.row, { gap: space.sm, marginTop: space.xs }]}>
              {dialog.buttons.map((b) => (
                <Button
                  key={b.text}
                  label={b.text}
                  variant={b.style === 'cancel' ? 'secondary' : 'primary'}
                  onPress={() => press(b)}
                  style={{ flex: 1, ...(b.style === 'destructive' ? { backgroundColor: colors.danger } : null) }}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
