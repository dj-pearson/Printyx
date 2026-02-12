/**
 * Badge Component
 *
 * Status badge for labels, counts, and status indicators.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '@/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export function Badge({ label, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <View style={[styles.base, variantStyles[variant].container, sizeMap[size].container]}>
      <Text style={[variantStyles[variant].text, sizeMap[size].text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
  },
});

const variantStyles: Record<BadgeVariant, { container: ViewStyle; text: TextStyle }> = {
  default: {
    container: { backgroundColor: colors.gray[100] },
    text: { color: colors.gray[700] },
  },
  success: {
    container: { backgroundColor: colors.success.light },
    text: { color: colors.success.dark },
  },
  warning: {
    container: { backgroundColor: colors.warning.light },
    text: { color: colors.warning.dark },
  },
  error: {
    container: { backgroundColor: colors.error.light },
    text: { color: colors.error.dark },
  },
  info: {
    container: { backgroundColor: colors.info.light },
    text: { color: colors.info.dark },
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.gray[300],
    },
    text: { color: colors.gray[600] },
  },
};

const sizeMap: Record<'sm' | 'md', { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
    text: { ...typography.caption, fontWeight: '500' },
  },
  md: {
    container: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    text: { ...typography.bodySmall, fontWeight: '500' },
  },
};
