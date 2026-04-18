/**
 * GlassTabBar
 *
 * Custom frosted-glass bottom tab bar for React Navigation / Expo Router.
 * Provides the modern iOS 26-style floating translucent bar with haptic
 * selection feedback, scale animation on the active tab, and a pill-shaped
 * indicator behind the active icon.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from './GlassSurface';
import { borderRadius, colors, motion, spacing, typography } from '@/theme';

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: bottomPadding, paddingHorizontal: spacing.lg },
      ]}
    >
      <GlassSurface
        tone="chrome"
        intensity={85}
        radius={borderRadius['2xl']}
        elevation="xl"
        withSheen
        style={styles.bar}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;

          const onPress = () => {
            if (!isFocused) {
              Haptics.selectionAsync();
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          const onLongPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabButton
              key={route.key}
              label={label}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              renderIcon={options.tabBarIcon as TabIconRenderer | undefined}
            />
          );
        })}
      </GlassSurface>
    </View>
  );
}

type TabIconRenderer = (opts: {
  focused: boolean;
  color: string;
  size: number;
}) => React.ReactNode;

interface TabButtonProps {
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
  renderIcon?: TabIconRenderer;
}

function TabButton({
  label,
  isFocused,
  onPress,
  onLongPress,
  accessibilityLabel,
  renderIcon,
}: TabButtonProps) {
  const scale = useSharedValue(isFocused ? 1 : 0.92);
  const indicator = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1.08 : 1, motion.spring.bouncy);
    indicator.value = withSpring(isFocused ? 1 : 0, motion.spring.gentle);
  }, [isFocused, scale, indicator]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: isFocused ? -2 : 0 }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicator.value,
    transform: [{ scale: indicator.value }],
  }));

  const activeColor = colors.primary[600];
  const inactiveColor = colors.gray[500];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel}
      style={styles.tab}
      hitSlop={8}
    >
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      <Animated.View style={iconStyle}>
        {renderIcon?.({
          focused: isFocused,
          color: isFocused ? activeColor : inactiveColor,
          size: 24,
        })}
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: isFocused ? activeColor : inactiveColor },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
    minHeight: 52,
  },
  indicator: {
    position: 'absolute',
    top: 2,
    width: 48,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    opacity: 0,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
