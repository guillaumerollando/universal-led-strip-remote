import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, space } from './theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', busy, disabled, style }: ButtonProps): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.35 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.accentText : colors.text} />
      ) : (
        <Text style={[styles.buttonText, variant !== 'primary' && { color: variant === 'ghost' ? colors.accent : colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Écran défilant qui remonte le champ en cours de saisie au-dessus du clavier. */
export function Screen({ children, safeTop, header }: { children: ReactNode; safeTop?: boolean; header?: ReactNode }): ReactNode {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      {/* En-tête qui reste en haut pendant qu'on fait défiler le reste (aperçu de « Créer mon ambiance »). */}
      {header && (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, gap: space.sm, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {header}
        </View>
      )}
      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }, safeTop && { paddingTop: insets.top + space.lg }]}
        bottomOffset={96}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </KeyboardAwareScrollView>
      {/* Sans en-tête, la liste défilerait sous l'heure et la batterie : un voile couleur de nuit les protège. */}
      {safeTop && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.bg, opacity: 0.94 }} />}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }): ReactNode {
  return <Text style={styles.section}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }): ReactNode {
  return <Text style={styles.muted}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  button: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.accentText, fontSize: font.body, fontWeight: '700' },
  section: { color: colors.textDim, fontSize: font.small, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: space.lg },
  title: { color: colors.text, fontSize: font.title, fontWeight: '700' },
  big: { color: colors.text, fontSize: font.big, fontWeight: '800' },
  text: { color: colors.text, fontSize: font.body },
  muted: { color: colors.textDim, fontSize: font.small, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    minHeight: 48,
    fontSize: font.body,
  },
});
