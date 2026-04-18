/**
 * ListItem
 *
 * Reusable list row with icon, title, subtitle, right content, chevron,
 * and subtle scale-on-press feedback.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  borderRadius,
  colors,
  motion,
  spacing,
  touchTargets,
  typography,
} from '@/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  iconBackground?: string;
  rightContent?: React.ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ListItem({
  title,
  subtitle,
  description,
  icon,
  iconColor,
  iconBackground,
  rightContent,
  showChevron = true,
  destructive = false,
  onPress,
  accessibilityLabel,
}: ListItemProps) {
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
    Haptics.selectionAsync();
    onPress();
  }, [onPress]);

  const effectiveIconColor = destructive
    ? colors.error.main
    : iconColor ?? colors.primary[600];
  const effectiveIconBg = destructive
    ? colors.error.light
    : iconBackground ?? colors.primary[50];
  const titleColor = destructive ? colors.error.dark : colors.text.primary;

  const content = (
    <View style={styles.container}>
      {icon ? (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: effectiveIconBg },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={effectiveIconColor}
          />
        </View>
      ) : null}
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {rightContent ? (
        <View style={styles.rightContent}>{rightContent}</View>
      ) : null}
      {onPress && showChevron ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={colors.gray[400]}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return <View accessibilityLabel={accessibilityLabel}>{content}</View>;
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={animatedStyle}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: touchTargets.comfortable,
    gap: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  description: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  rightContent: {
    marginLeft: spacing.sm,
  },
});
