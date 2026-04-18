/**
 * Input
 *
 * Form input with floating-label style, animated focus ring, optional
 * leading/trailing adornments, and accessibility support.
 */

import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  borderRadius,
  colors,
  motion,
  spacing,
  touchTargets,
  typography,
} from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  trailingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onTrailingPress?: () => void;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leadingIcon,
      trailingIcon,
      onTrailingPress,
      containerStyle,
      required,
      style,
      secureTextEntry,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const [visible, setVisible] = useState(!secureTextEntry);
    const focus = useSharedValue(0);

    const fieldStyle = useAnimatedStyle(() => ({
      borderColor: error
        ? colors.error.main
        : focus.value > 0.5
        ? colors.primary[500]
        : colors.gray[200],
      shadowOpacity: focus.value * 0.18,
    }));

    const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setFocused(true);
      focus.value = withTiming(1, { duration: motion.duration.fast });
      onFocus?.(e);
    };

    const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setFocused(false);
      focus.value = withTiming(0, { duration: motion.duration.fast });
      onBlur?.(e);
    };

    const showPasswordToggle = secureTextEntry === true;
    const effectiveTrailing = showPasswordToggle
      ? visible
        ? 'eye-off-outline'
        : 'eye-outline'
      : trailingIcon;

    const handleTrailing = () => {
      if (showPasswordToggle) {
        setVisible((v) => !v);
        return;
      }
      onTrailingPress?.();
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        ) : null}

        <Animated.View style={[styles.fieldBase, fieldStyle]}>
          {leadingIcon ? (
            <MaterialCommunityIcons
              name={leadingIcon}
              size={20}
              color={focused ? colors.primary[500] : colors.gray[400]}
              style={styles.leading}
            />
          ) : null}

          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor={colors.text.tertiary}
            accessibilityLabel={label}
            accessibilityState={{ disabled: props.editable === false }}
            secureTextEntry={showPasswordToggle ? !visible : false}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />

          {effectiveTrailing ? (
            <Pressable
              onPress={handleTrailing}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={showPasswordToggle ? 'Toggle password visibility' : 'Field action'}
              style={({ pressed }) => [styles.trailing, pressed && { opacity: 0.6 }]}
            >
              <MaterialCommunityIcons
                name={effectiveTrailing}
                size={20}
                color={colors.gray[500]}
              />
            </Pressable>
          ) : null}
        </Animated.View>

        {error ? (
          <View style={styles.messageRow}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={14}
              color={colors.error.main}
            />
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          </View>
        ) : helperText ? (
          <Text style={styles.helperText}>{helperText}</Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  required: {
    color: colors.error.main,
  },
  fieldBase: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    minHeight: touchTargets.minimum + 4,
    paddingHorizontal: spacing.md,
    shadowColor: colors.primary[400],
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 0,
  },
  leading: {
    marginRight: spacing.sm,
  },
  trailing: {
    marginLeft: spacing.sm,
    padding: 4,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    paddingVertical: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  errorText: {
    ...typography.caption,
    color: colors.error.main,
    fontWeight: '500',
  },
  helperText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 6,
  },
});
