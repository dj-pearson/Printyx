/**
 * EmptyState
 *
 * Consistent empty/zero state with an animated gradient icon bubble,
 * title, description, and optional action.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  borderRadius,
  colors,
  gradients,
  motion,
  spacing,
  typography,
} from '@/theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon = 'inbox-outline',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0, { duration: 1800 }),
      ),
      -1,
      false,
    );
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 + float.value * 8 }],
  }));

  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withDelay(80, withTiming(1, { duration: motion.duration.base }));
  }, [appear]);

  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 8 }],
  }));

  return (
    <Animated.View
      style={[styles.container, compact && styles.compact, appearStyle]}
      accessibilityRole="text"
    >
      <Animated.View style={floatStyle}>
        <LinearGradient
          colors={gradients.brandSoft as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBubble}
        >
          <MaterialCommunityIcons
            name={icon}
            size={compact ? 36 : 48}
            color={colors.primary[600]}
          />
        </LinearGradient>
      </Animated.View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="gradient"
          size="md"
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['5xl'],
    gap: spacing.lg,
  },
  compact: {
    paddingVertical: spacing['2xl'],
    gap: spacing.md,
  },
  iconBubble: {
    width: 96,
    height: 96,
    borderRadius: borderRadius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },
});
