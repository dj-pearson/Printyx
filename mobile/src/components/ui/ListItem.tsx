/**
 * ListItem Component
 *
 * Reusable list row with icon, title, subtitle, right content, and chevron.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, touchTargets } from '@/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  rightContent?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function ListItem({
  title,
  subtitle,
  icon,
  iconColor = colors.gray[500],
  rightContent,
  showChevron = true,
  onPress,
  accessibilityLabel,
}: ListItemProps) {
  const content = (
    <View style={styles.container}>
      {icon && (
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
        </View>
      )}
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
      {onPress && showChevron && (
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray[400]} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.body,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  rightContent: {
    marginLeft: spacing.sm,
  },
});
