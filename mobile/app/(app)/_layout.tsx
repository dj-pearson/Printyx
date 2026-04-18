/**
 * Authenticated App Layout
 *
 * Bottom tab navigation using a custom frosted-glass tab bar for a modern
 * iOS feel. Icons use MaterialCommunityIcons with dual-state filled/outline
 * glyphs to emphasize the active tab.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { GlassTabBar } from '@/components/ui';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function iconFor(
  focused: IconName,
  unfocused: IconName,
): (opts: { focused: boolean; color: string; size: number }) => React.ReactNode {
  return ({ focused: isFocused, color, size }) => (
    <MaterialCommunityIcons
      name={isFocused ? focused : unfocused}
      color={color}
      size={size}
    />
  );
}

export default function AppLayout() {
  // Register for push notifications when app loads
  usePushNotifications();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: 'Home',
          tabBarIcon: iconFor('view-dashboard', 'view-dashboard-outline'),
        }}
      />
      <Tabs.Screen
        name="(crm)"
        options={{
          title: 'CRM',
          tabBarIcon: iconFor('account-group', 'account-group-outline'),
        }}
      />
      <Tabs.Screen
        name="(service)"
        options={{
          title: 'Service',
          tabBarIcon: iconFor('wrench', 'wrench-outline'),
        }}
      />
      <Tabs.Screen
        name="(equipment)"
        options={{
          title: 'Fleet',
          tabBarIcon: iconFor('printer', 'printer-outline'),
        }}
      />
      <Tabs.Screen
        name="(reports)"
        options={{
          title: 'Reports',
          tabBarIcon: iconFor('chart-box', 'chart-box-outline'),
        }}
      />
      <Tabs.Screen
        name="(settings)"
        options={{
          title: 'More',
          tabBarIcon: iconFor('dots-horizontal-circle', 'dots-horizontal-circle-outline'),
        }}
      />
    </Tabs>
  );
}
