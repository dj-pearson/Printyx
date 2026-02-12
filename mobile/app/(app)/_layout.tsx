/**
 * Authenticated App Layout
 *
 * Bottom tab navigation matching the platform's core features.
 * Uses MaterialCommunityIcons for consistent iconography.
 */

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { colors, typography } from '@/theme';

type TabIconProps = {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  size: number;
};

function TabIcon({ name, color, size }: TabIconProps) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export default function AppLayout() {
  // Register for push notifications when app loads
  usePushNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="view-dashboard" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(crm)"
        options={{
          title: 'CRM',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="account-group" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(service)"
        options={{
          title: 'Service',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="wrench" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(equipment)"
        options={{
          title: 'Equipment',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="printer" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(reports)"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="chart-bar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(settings)"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="dots-horizontal" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background.default,
    borderTopColor: colors.gray[200],
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '500',
  },
});
