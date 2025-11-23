import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';
import { ActivityIndicator, View } from 'react-native';

/**
 * Root Navigation Component
 * Routes to authenticated or unauthenticated navigator based on auth state
 */
export default function Navigation() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
