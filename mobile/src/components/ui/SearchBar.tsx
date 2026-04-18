/**
 * SearchBar
 *
 * Pill-shaped search input with optional glass background, leading magnifier,
 * clear button, and animated focus state.
 */

import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  borderRadius,
  colors,
  motion,
  spacing,
  touchTargets,
  typography,
} from '@/theme';
import { GlassSurface } from './GlassSurface';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  variant?: 'solid' | 'glass';
  onSubmit?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus = false,
  variant = 'solid',
  onSubmit,
  style,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const focusValue = useSharedValue(0);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor:
      focusValue.value > 0.5 ? colors.primary[400] : 'transparent',
    shadowOpacity: focusValue.value * 0.18,
  }));

  const handleFocus = () => {
    setFocused(true);
    focusValue.value = withTiming(1, { duration: motion.duration.fast });
  };
  const handleBlur = () => {
    setFocused(false);
    focusValue.value = withTiming(0, { duration: motion.duration.fast });
  };

  const handleClear = () => {
    Haptics.selectionAsync();
    onChangeText('');
  };

  const inner = (
    <View style={styles.row}>
      <MaterialCommunityIcons
        name="magnify"
        size={20}
        color={focused ? colors.primary[500] : colors.gray[500]}
      />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={onSubmit}
        accessibilityLabel="Search"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={18}
            color={colors.gray[400]}
          />
        </Pressable>
      ) : null}
    </View>
  );

  if (variant === 'glass') {
    return (
      <Animated.View style={[styles.glassWrap, ringStyle, style]}>
        <GlassSurface
          tone="light"
          intensity={60}
          radius={borderRadius.full}
          elevation="sm"
          style={styles.glassInner}
        >
          {inner}
        </GlassSurface>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.solid, ringStyle, style]}>
      {inner}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  solid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
    borderWidth: 1.5,
    shadowColor: colors.primary[400],
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  glassWrap: {
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    shadowColor: colors.primary[400],
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  glassInner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
});
