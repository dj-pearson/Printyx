/**
 * EmptyState Component
 *
 * Consistent empty state display with icon, title, description, and optional action.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'inbox-outline',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityRole="text">
      <MaterialCommunityIcons
        name={icon}
        size={64}
        color={colors.gray[300]}
      />
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="sm"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['5xl'],
    gap: spacing.md,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 300,
  },
});
