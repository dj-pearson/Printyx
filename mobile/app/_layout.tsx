/**
 * Root Layout
 *
 * Entry point for the Expo Router app. Sets up all providers
 * and handles the auth-based routing redirect.
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AuthProvider, useAuthContext } from '@/providers/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { remoteLog } from '@/lib/remoteLogger';
import { RemoteErrorBoundary } from '@/components/RemoteErrorBoundary';
import { config } from '@/config';
import { colors } from '@/theme';

// Keep splash screen visible until auth state is resolved
SplashScreen.preventAutoHideAsync();

// Log app startup config so we can verify routing in server logs
remoteLog.info('App startup', {
  apiBaseUrl: config.apiBaseUrl,
  edgeFunctionsUrl: config.edgeFunctionsUrl,
  supabaseUrl: config.supabase.url,
  hasAnonKey: !!config.supabase.anonKey,
  isDev: config.isDevelopment,
}, 'RootLayout');

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    remoteLog.info('Auth state resolved', {
      isAuthenticated,
      segments: segments.join('/'),
    }, 'RootLayout');

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main app
      router.replace('/(app)/(dashboard)');
    }
  }, [isAuthenticated, isLoading, segments]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <RemoteErrorBoundary screen="Root">
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </RemoteErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
});
