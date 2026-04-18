/**
 * Card
 *
 * Flexible container with press animation, haptic feedback, and optional
 * glass background. For full glassmorphism, pass `variant="glass"` — this
 * routes through GlassSurface for native BlurView rendering.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { borderRadius, colors, motion, shadows, spacing } from '@/theme';
import { GlassSurface, GlassTone } from './GlassSurface';

type CardVariant = 'elevated' | 'outlined' | 'flat' | 'glass';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: CardVariant;
  tone?: GlassTone;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  radius?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  children,
  onPress,
  variant = 'elevated',
  tone = 'light',
  style,
  padded = true,
  radius = borderRadius.xl,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(motion.pressScale.subtle, motion.spring.stiff);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, motion.spring.gentle);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  if (variant === 'glass') {
    const inner = (
      <GlassSurface tone={tone} radius={radius} elevation="md" style={padded ? styles.padded : undefined}>
        {children}
      </GlassSurface>
    );
    if (!onPress) return <View style={style}>{inner}</View>;
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[animatedStyle, style]}
      >
        {inner}
      </AnimatedPressable>
    );
  }

  const containerStyle: ViewStyle[] = [
    styles.card,
    VARIANT_STYLES[variant],
    { borderRadius: radius },
    padded && styles.padded,
  ];

  if (!onPress) {
    return (
      <View style={[containerStyle, style]} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[animatedStyle, containerStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.default,
  },
  padded: {
    padding: spacing.lg,
  },
});

const VARIANT_STYLES: Record<Exclude<CardVariant, 'glass'>, ViewStyle> = {
  elevated: {
    ...shadows.md,
  },
  outlined: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
  },
  flat: {
    backgroundColor: colors.background.secondary,
  },
};
