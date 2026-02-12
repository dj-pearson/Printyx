/**
 * App Entry Point
 *
 * Redirects to the appropriate group based on auth state.
 * This file is needed by Expo Router for the root index route.
 */

import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Starting Printyx..." />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(dashboard)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
