/**
 * StatCard Component
 *
 * Dashboard statistic card with icon, value, label, and optional trend.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, icon, iconColor = colors.primary[600], trend }: StatCardProps) {
  return (
    <View style={styles.card} accessibilityRole="text" accessibilityLabel={`${title}: ${value}`}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
          <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
        </View>
        {trend && (
          <View style={[styles.trendContainer, trend.isPositive ? styles.trendPositive : styles.trendNegative]}>
            <MaterialCommunityIcons
              name={trend.isPositive ? 'trending-up' : 'trending-down'}
              size={14}
              color={trend.isPositive ? colors.success.dark : colors.error.dark}
            />
            <Text
              style={[
                styles.trendText,
                { color: trend.isPositive ? colors.success.dark : colors.error.dark },
              ]}
            >
              {Math.abs(trend.value)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.default,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
    flex: 1,
    minWidth: 140,
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
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  trendPositive: {
    backgroundColor: colors.success.light,
  },
  trendNegative: {
    backgroundColor: colors.error.light,
  },
  trendText: {
    ...typography.caption,
    fontWeight: '600',
  },
  value: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: 2,
  },
  title: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
