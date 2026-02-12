import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function EquipmentLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background.default },
        headerTintColor: colors.text.primary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Equipment' }} />
      <Stack.Screen name="[id]" options={{ title: 'Equipment Details' }} />
    </Stack>
  );
}
