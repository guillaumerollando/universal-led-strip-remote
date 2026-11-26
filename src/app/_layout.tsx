import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { loadDevices } from '../services/store';
import { colors } from '../ui/theme';
import { t } from '../i18n';

export default function RootLayout() {
  useEffect(() => {
    void loadDevices();
  }, []);

  return (
    <KeyboardProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ title: t('Ajouter un ruban') }} />
        <Stack.Screen name="device/[key]" options={{ title: t('Ruban') }} />
        <Stack.Screen name="room/[id]" options={{ title: t('Pièce') }} />
        <Stack.Screen name="new/[key]" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="about" options={{ title: t('À propos') }} />
        <Stack.Screen name="ir-new" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="power" options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
    </KeyboardProvider>
  );
}
