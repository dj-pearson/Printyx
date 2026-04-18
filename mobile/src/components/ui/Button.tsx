/**
 * Button
 *
 * Platform-aware button with proper touch targets (44pt min), scale-on-press
 * haptic feedback, loading state, and a primary-gradient variant for hero CTAs.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  borderRadius,
  colors,
  gradients,
  motion,
  shadows,
  spacing,
  touchTargets,
  typography,
} from '@/theme';

type ButtonVariant =
  | 'primary'
  | 'gradient'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle | ViewStyle[];
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  trailingIcon,
  fullWidth = false,
  haptic = 'medium',
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
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
    if (disabled || loading) return;
    if (haptic !== 'none') {
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      } as const;
      Haptics.impactAsync(map[haptic]);
    }
    onPress();
  }, [disabled, loading, onPress, haptic]);

  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const textColor = variantStyle.text.color ?? colors.text.primary;

  const innerContent = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          <Text style={[sizeStyle.text, variantStyle.text]} numberOfLines={1}>
            {title}
          </Text>
          {trailingIcon ? <View style={styles.iconWrap}>{trailingIcon}</View> : null}
        </>
      )}
    </>
  );

  const container: ViewStyle[] = [
    styles.base,
    sizeStyle.container,
    variantStyle.container,
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
  ].filter(Boolean) as ViewStyle[];

  if (variant === 'gradient') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        style={[animatedStyle, fullWidth && styles.fullWidth, shadows.glow, style]}
      >
        <LinearGradient
          colors={gradients.brand as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            sizeStyle.container,
            { borderRadius: borderRadius.xl },
            fullWidth && styles.fullWidth,
            (disabled || loading) && styles.disabled,
          ]}
        >
          {innerContent}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[animatedStyle, container, style]}
    >
      {innerContent}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.xl,
    minHeight: touchTargets.minimum,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const VARIANT_STYLES: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: {
      backgroundColor: colors.primary[600],
      ...shadows.sm,
    },
    text: { color: '#ffffff' },
  },
  gradient: {
    container: {},
    text: { color: '#ffffff' },
  },
  secondary: {
    container: {
      backgroundColor: colors.gray[100],
    },
    text: { color: colors.gray[900] },
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.gray[300],
    },
    text: { color: colors.gray[700] },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: colors.primary[600] },
  },
  destructive: {
    container: {
      backgroundColor: colors.error.main,
      ...shadows.sm,
    },
    text: { color: '#ffffff' },
  },
  glass: {
    container: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    text: { color: '#ffffff' },
  },
};

const SIZE_STYLES: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      minHeight: 40,
    },
    text: { ...typography.buttonSmall },
  },
  md: {
    container: {
      paddingHorizontal: spacing.xl,
      paddingVertical: 13,
    },
    text: { ...typography.button },
  },
  lg: {
    container: {
      paddingHorizontal: spacing['2xl'],
      paddingVertical: 16,
      minHeight: 54,
    },
    text: { ...typography.button, fontSize: 17 },
  },
};
