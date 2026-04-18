/**
 * SectionHeader
 *
 * Consistent in-screen section title with optional overline label,
 * description, and trailing action ("See all").
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  overline?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export function SectionHeader({
  title,
  subtitle,
  overline,
  actionLabel,
  onActionPress,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textWrap}>
        {overline ? <Text style={styles.overline}>{overline}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={colors.primary[600]}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  textWrap: {
    flex: 1,
    marginRight: spacing.md,
  },
  overline: {
    ...typography.overline,
    color: colors.primary[600],
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  actionText: {
    ...typography.buttonSmall,
    color: colors.primary[600],
  },
});
