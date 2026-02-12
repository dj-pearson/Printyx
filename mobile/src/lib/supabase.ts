/**
 * Supabase Client for React Native
 *
 * Uses expo-secure-store for secure token persistence (Keychain on iOS,
 * EncryptedSharedPreferences on Android) instead of localStorage.
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { config } from '@/config';
import 'react-native-url-polyfill/auto';

/**
 * Custom storage adapter using expo-secure-store.
 * Tokens are stored encrypted in the device keychain/keystore.
 */
const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // SecureStore may fail on some devices; fail silently
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Fail silently
    }
  },
};

export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Not applicable in React Native
  },
});

/**
 * Get the current access token, or null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Refresh the current session and return the new session.
 */
export async function refreshSession() {
  const { data } = await supabase.auth.refreshSession();
  return data.session;
}
