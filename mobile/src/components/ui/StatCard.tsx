/**
 * StatCard
 *
 * Dashboard statistic card with icon, value, label, and optional trend.
 * Supports two visual tiers:
 *   - `variant="glass"` (default) — frosted glass tile for the dashboard grid
 *   - `variant="hero"` — full-bleed gradient tile for a featured metric
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  borderRadius,
  colors,
  GradientKey,
  gradients,
  motion,
  shadows,
  spacing,
  typography,
} from '@/theme';
import { GlassSurface } from './GlassSurface';

type StatCardVariant = 'glass' | 'hero' | 'flat';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: StatCardVariant;
  gradient?: GradientKey;
  onPress?: () => void;
  delay?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function StatCard({
  title,
  value,
  icon,
  iconColor = colors.primary[600],
  trend,
  variant = 'glass',
  gradient = 'brand',
  onPress,
  delay = 0,
}: StatCardProps) {
  const enter = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    enter.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.base }),
    );
  }, [enter, delay]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(motion.pressScale.subtle, motion.spring.stiff);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, motion.spring.gentle);
  };

  const handlePress = () => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isHero = variant === 'hero';
  const textColor = isHero ? '#ffffff' : colors.text.primary;
  const secondaryTextColor = isHero ? 'rgba(255,255,255,0.78)' : colors.text.secondary;

  const body = (
    <>
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isHero
                ? 'rgba(255,255,255,0.2)'
                : iconColor + '15',
            },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={22}
            color={isHero ? '#ffffff' : iconColor}
          />
        </View>
        {trend ? (
          <View
            style={[
              styles.trendPill,
              trend.isPositive ? styles.trendPositive : styles.trendNegative,
              isHero && styles.trendOnHero,
            ]}
          >
            <MaterialCommunityIcons
              name={trend.isPositive ? 'trending-up' : 'trending-down'}
              size={12}
              color={
                isHero
                  ? '#ffffff'
                  : trend.isPositive
                  ? colors.success.dark
                  : colors.error.dark
              }
            />
            <Text
              style={[
                styles.trendText,
                {
                  color: isHero
                    ? '#ffffff'
                    : trend.isPositive
                    ? colors.success.dark
                    : colors.error.dark,
                },
              ]}
            >
              {Math.abs(trend.value)}%
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.value, { color: textColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.title, { color: secondaryTextColor }]} numberOfLines={2}>
        {title}
      </Text>
    </>
  );

  const wrapStyle = [styles.card, enterStyle, pressStyle];
  const accessibility = {
    accessibilityRole: onPress ? ('button' as const) : ('text' as const),
    accessibilityLabel: `${title}: ${value}${trend ? `, ${trend.isPositive ? 'up' : 'down'} ${Math.abs(trend.value)} percent` : ''}`,
  };

  if (variant === 'hero') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        {...accessibility}
        style={[wrapStyle, shadows.glow]}
      >
        <LinearGradient
          colors={gradients[gradient] as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.surface}
        >
          {body}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  if (variant === 'flat') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        {...accessibility}
        style={[wrapStyle, styles.flatCard]}
      >
        <View style={styles.surface}>{body}</View>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      {...accessibility}
      style={wrapStyle}
    >
      <GlassSurface tone="light" radius={borderRadius.xl} elevation="md">
        <View style={styles.surface}>{body}</View>
      </GlassSurface>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  flatCard: {
    backgroundColor: colors.background.default,
    ...shadows.md,
  },
  surface: {
    padding: spacing.lg,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  trendPositive: {
    backgroundColor: colors.success.light,
  },
  trendNegative: {
    backgroundColor: colors.error.light,
  },
  trendOnHero: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  trendText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  value: {
    ...typography.h1,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  title: {
    ...typography.caption,
    fontWeight: '500',
  },
});
