/**
 * Input Component
 *
 * Form input with label, error state, and accessibility support.
 */

import React, { forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, borderRadius, spacing, typography, touchTargets } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, helperText, containerStyle, required, style, ...props }, ref) => {
    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            error && styles.inputError,
            style,
          ]}
          placeholderTextColor={colors.text.tertiary}
          accessibilityLabel={label}
          accessibilityState={{ disabled: props.editable === false }}
          {...props}
        />
        {error && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        )}
        {helperText && !error && (
          <Text style={styles.helperText}>{helperText}</Text>
        )}
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
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error.main,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.default,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
  },
  inputError: {
    borderColor: colors.error.main,
  },
  errorText: {
    ...typography.caption,
    color: colors.error.main,
    marginTop: spacing.xs,
  },
  helperText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
