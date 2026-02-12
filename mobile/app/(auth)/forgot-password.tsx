/**
 * Forgot Password Screen
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type ForgotPasswordForm = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = useCallback(async (data: ForgotPasswordForm) => {
    setIsSubmitting(true);
    try {
      const result = await resetPassword(data.email);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setSent(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [resetPassword]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {sent
                ? 'Check your email for a password reset link.'
                : 'Enter your email and we\'ll send you a reset link.'}
            </Text>
          </View>

          {!sent && (
            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Email"
                    placeholder="you@company.com"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    required
                  />
                )}
              />

              <Button
                title="Send Reset Link"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                fullWidth
                size="lg"
              />
            </View>
          )}

          {sent && (
            <Button
              title="Back to Login"
              onPress={() => router.replace('/(auth)/login')}
              variant="primary"
              fullWidth
              size="lg"
            />
          )}

          <View style={styles.footer}>
            <Link href="/(auth)/login" asChild>
              <Text style={styles.footerLink}>Back to Sign In</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
  },
  header: {
    marginBottom: spacing['3xl'],
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  form: {
    marginBottom: spacing.xl,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerLink: {
    ...typography.body,
    color: colors.primary[600],
    fontWeight: '600',
  },
});
