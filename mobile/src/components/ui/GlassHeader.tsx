/**
 * GlassHeader
 *
 * Sticky translucent header with an optional large-title pattern.
 * Mirrors the native iOS "large title" behaviour: large on scroll top,
 * condenses to an inline title with a frosted bar as the user scrolls.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassSurface } from './GlassSurface';
import { borderRadius, colors, spacing, typography } from '@/theme';

interface GlassHeaderProps {
  title: string;
  subtitle?: string;
  /** Animated scroll offset. If provided, triggers the large-title collapse. */
  scrollY?: SharedValue<number>;
  onBack?: () => void;
  rightAction?: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    onPress: () => void;
    accessibilityLabel: string;
  };
  /** Threshold (in px) at which the inline bar becomes fully opaque. */
  collapseOffset?: number;
  style?: ViewStyle | ViewStyle[];
}

export function GlassHeader({
  title,
  subtitle,
  scrollY,
  onBack,
  rightAction,
  collapseOffset = 64,
  style,
}: GlassHeaderProps) {
  const insets = useSafeAreaInsets();

  const barStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1 };
    const opacity = interpolate(
      scrollY.value,
      [0, collapseOffset * 0.5, collapseOffset],
      [0, 0.4, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  const titleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1, transform: [{ translateY: 0 }] };
    const opacity = interpolate(
      scrollY.value,
      [collapseOffset * 0.6, collapseOffset],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [collapseOffset * 0.6, collapseOffset],
      [8, 0],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, barStyle]} pointerEvents="none">
        <GlassSurface
          tone="chrome"
          intensity={80}
          radius={0}
          elevation="sm"
          withSheen={false}
          withBorder={false}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.hairline} />
      </Animated.View>

      <View style={styles.row}>
        {onBack ? (
          <HeaderButton
            icon="chevron-left"
            accessibilityLabel="Back"
            onPress={onBack}
          />
        ) : (
          <View style={styles.spacer} />
        )}

        <Animated.View style={[styles.titleWrapper, titleStyle]}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>

        {rightAction ? (
          <HeaderButton
            icon={rightAction.icon}
            accessibilityLabel={rightAction.accessibilityLabel}
            onPress={rightAction.onPress}
          />
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    </View>
  );
}

interface HeaderButtonProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
}

function HeaderButton({ icon, accessibilityLabel, onPress }: HeaderButtonProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary[600]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  hairline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,23,42,0.1)',
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 40,
    height: 40,
  },
});
