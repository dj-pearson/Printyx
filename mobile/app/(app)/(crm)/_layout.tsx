import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function CRMLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background.default },
        headerTintColor: colors.text.primary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'CRM' }} />
      <Stack.Screen name="leads" options={{ title: 'Leads' }} />
      <Stack.Screen name="customers" options={{ title: 'Customers' }} />
      <Stack.Screen name="contacts" options={{ title: 'Contacts' }} />
      <Stack.Screen name="deals" options={{ title: 'Deals' }} />
      <Stack.Screen name="[id]" options={{ title: 'Details' }} />
    </Stack>
  );
}
