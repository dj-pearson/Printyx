/**
 * Button Component
 *
 * Platform-aware button with proper touch targets (min 44pt/48dp),
 * haptic feedback, and loading states.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, borderRadius, spacing, typography, touchTargets } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const containerStyle: ViewStyle[] = [
    styles.base,
    variantStyles[variant].container,
    sizeStyles[size].container,
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
  ].filter(Boolean) as ViewStyle[];

  const textStyle: TextStyle[] = [
    variantStyles[variant].text,
    sizeStyles[size].text,
    (disabled || loading) && styles.disabledText,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      style={containerStyle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'destructive' ? '#fff' : colors.primary[600]}
        />
      ) : (
        <>
          {icon}
          <Text style={textStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.lg,
    minHeight: touchTargets.minimum,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: colors.primary[600] },
    text: { color: '#ffffff' },
  },
  secondary: {
    container: { backgroundColor: colors.gray[100] },
    text: { color: colors.gray[900] },
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.gray[300],
    },
    text: { color: colors.gray[700] },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: colors.primary[600] },
  },
  destructive: {
    container: { backgroundColor: colors.error.main },
    text: { color: '#ffffff' },
  },
};

const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    text: { ...typography.buttonSmall },
  },
  md: {
    container: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    text: { ...typography.button },
  },
  lg: {
    container: { paddingHorizontal: spacing['2xl'], paddingVertical: spacing.lg },
    text: { ...typography.button, fontSize: 18 },
  },
};
