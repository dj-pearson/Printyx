import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ServiceLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background.default },
        headerTintColor: colors.text.primary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Service' }} />
      <Stack.Screen name="tickets" options={{ title: 'Service Tickets' }} />
      <Stack.Screen name="dispatch" options={{ title: 'Dispatch' }} />
      <Stack.Screen name="field-service" options={{ title: 'Field Service' }} />
    </Stack>
  );
}
