/**
 * GlassCard
 *
 * Tappable glass container for dashboard tiles, list headers, and
 * anywhere a translucent surface is desired. Includes scale-and-haptic
 * press feedback and accessibility roles.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GlassElevation, GlassSurface, GlassTone } from './GlassSurface';
import { borderRadius, motion, spacing } from '@/theme';

interface GlassCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: GlassTone;
  intensity?: number;
  radius?: number;
  elevation?: GlassElevation;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassCard({
  children,
  onPress,
  onLongPress,
  tone = 'light',
  intensity,
  radius = borderRadius.xl,
  elevation = 'md',
  padded = true,
  style,
  disabled = false,
  haptic = 'light',
  accessibilityLabel,
  accessibilityHint,
}: GlassCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(motion.pressScale.default, motion.spring.stiff);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, motion.spring.gentle);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled || !onPress) return;
    if (haptic !== 'none') {
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      } as const;
      Haptics.impactAsync(map[haptic]);
    }
    onPress();
  }, [onPress, disabled, haptic]);

  const content = (
    <GlassSurface
      tone={tone}
      intensity={intensity}
      radius={radius}
      elevation={elevation}
      style={[padded ? styles.padded : null, disabled ? styles.disabled : null]}
    >
      {children}
    </GlassSurface>
  );

  if (!onPress && !onLongPress) {
    return <Animated.View style={style}>{content}</Animated.View>;
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[animatedStyle, style]}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: spacing.lg,
  },
  disabled: {
    opacity: 0.5,
  },
});
