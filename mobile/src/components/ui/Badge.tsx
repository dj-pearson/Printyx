/**
 * Badge
 *
 * Status pill for labels, counts, and status indicators. Optional dot
 * prefix for status indicators; optional gradient variant for featured
 * callouts.
 */

import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  borderRadius,
  colors,
  GradientKey,
  gradients,
  spacing,
  typography,
} from '@/theme';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'outline'
  | 'gradient';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  withDot?: boolean;
  gradient?: GradientKey;
}

export function Badge({
  label,
  variant = 'default',
  size = 'sm',
  icon,
  withDot = false,
  gradient = 'brand',
}: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={gradients[gradient] as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, s.container]}
      >
        {renderInner({ label, icon, withDot, v, s, tintOverride: '#ffffff' })}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.base, v.container, s.container]}>
      {renderInner({ label, icon, withDot, v, s })}
    </View>
  );
}

function renderInner({
  label,
  icon,
  withDot,
  v,
  s,
  tintOverride,
}: {
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  withDot: boolean;
  v: { container: ViewStyle; text: TextStyle };
  s: { container: ViewStyle; text: TextStyle };
  tintOverride?: string;
}) {
  const textColor = tintOverride ?? (v.text.color as string);
  return (
    <>
      {withDot ? (
        <View style={[styles.dot, { backgroundColor: textColor }]} />
      ) : null}
      {icon ? (
        <MaterialCommunityIcons name={icon} size={12} color={textColor} />
      ) : null}
      <Text style={[s.text, v.text, tintOverride ? { color: tintOverride } : null]}>
        {label}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

const VARIANT_STYLES: Record<Exclude<BadgeVariant, 'gradient'>, { container: ViewStyle; text: TextStyle }> = {
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.gray[300],
    },
    text: { color: colors.gray[600] },
  },
};

const SIZE_STYLES: Record<'sm' | 'md', { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingHorizontal: spacing.sm, paddingVertical: 3 },
    text: { ...typography.caption, fontWeight: '600', fontSize: 11 },
  },
  md: {
    container: { paddingHorizontal: spacing.md, paddingVertical: 5 },
    text: { ...typography.bodySmall, fontWeight: '600' },
  },
};
