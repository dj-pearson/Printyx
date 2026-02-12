/**
 * Push Notifications Hook
 *
 * Handles registration for APNs (iOS) and FCM (Android),
 * permission requests, and token storage.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiRequest } from '@/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    expoPushToken: null,
    notification: null,
    error: null,
  });

  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  const registerForPushNotifications = useCallback(async () => {
    if (!Device.isDevice) {
      setState((prev) => ({ ...prev, error: 'Push notifications require a physical device' }));
      return;
    }

    // Check/request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      setState((prev) => ({ ...prev, error: 'Push notification permission not granted' }));
      return;
    }

    // Android: Create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
      });

      await Notifications.setNotificationChannelAsync('service', {
        name: 'Service Alerts',
        description: 'Service dispatch and ticket notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ef4444',
      });

      await Notifications.setNotificationChannelAsync('sales', {
        name: 'Sales Updates',
        description: 'Lead, deal, and quote notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#3b82f6',
      });
    }

    // Get Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      setState((prev) => ({ ...prev, expoPushToken: tokenData.data, error: null }));

      // Register token with backend
      try {
        await apiRequest('/api/mobile/push-token', {
          method: 'POST',
          body: {
            token: tokenData.data,
            platform: Platform.OS,
            deviceName: Device.deviceName,
          },
        });
      } catch {
        // Non-critical: token will be re-registered on next app launch
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to get push token',
      }));
    }
  }, []);

  useEffect(() => {
    registerForPushNotifications();

    // Listen for incoming notifications while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setState((prev) => ({ ...prev, notification }));
      },
    );

    // Listen for user tapping on notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        // Handle deep link from notification payload
        if (data?.url) {
          // Navigation will be handled by expo-router's linking
        }
      },
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [registerForPushNotifications]);

  return state;
}
