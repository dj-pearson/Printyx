/**
 * Forgot Password Screen
 *
 * Branded reset-password experience with a success confirmation state.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '@/hooks/useAuth';
import {
  Button,
  GlassSurface,
  GradientBackground,
  Input,
} from '@/components/ui';
import {
  borderRadius,
  colors,
  gradients,
  motion,
  spacing,
  typography,
} from '@/theme';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type ForgotPasswordForm = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const entrance = useSharedValue(0);

  useEffect(() => {
    entrance.value = withTiming(1, { duration: motion.duration.slow });
  }, [entrance]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 20 }],
  }));

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = useCallback(
    async (data: ForgotPasswordForm) => {
      setIsSubmitting(true);
      try {
        const result = await resetPassword(data.email);
        if (result.error) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Error', result.error);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSent(true);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [resetPassword],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <GradientBackground variant="hero" withOrbs style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={entranceStyle}>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={24}
                  color="#ffffff"
                />
              </Pressable>
            </Animated.View>

            <Animated.View style={[styles.hero, entranceStyle]}>
              <Text style={styles.heroTitle}>
                {sent ? 'Check your email' : 'Reset password'}
              </Text>
              <Text style={styles.heroSubtitle}>
                {sent
                  ? "We've sent you a secure reset link. It will expire in 30 minutes."
                  : "Enter your work email and we'll send you a reset link."}
              </Text>
            </Animated.View>

            <Animated.View style={entranceStyle}>
              {sent ? (
                <GlassSurface
                  tone="light"
                  intensity={70}
                  radius={borderRadius['2xl']}
                  elevation="xl"
                  style={styles.successCard}
                >
                  <LinearGradient
                    colors={gradients.success as unknown as string[]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.successIcon}
                  >
                    <MaterialCommunityIcons
                      name="email-check-outline"
                      size={36}
                      color="#ffffff"
                    />
                  </LinearGradient>
                  <Text style={styles.successTitle}>
                    Reset link sent
                  </Text>
                  <Text style={styles.successDescription}>
                    Follow the instructions in the email to create a new password.
                    Didn't see it? Check your spam folder or try again.
                  </Text>
                  <Button
                    title="Back to sign in"
                    onPress={() => router.replace('/(auth)/login')}
                    variant="gradient"
                    fullWidth
                    size="lg"
                  />
                </GlassSurface>
              ) : (
                <GlassSurface
                  tone="light"
                  intensity={70}
                  radius={borderRadius['2xl']}
                  elevation="xl"
                  style={styles.formCard}
                >
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
                        leadingIcon="email-outline"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        textContentType="emailAddress"
                        required
                      />
                    )}
                  />

                  <Button
                    title="Send reset link"
                    onPress={handleSubmit(onSubmit)}
                    loading={isSubmitting}
                    fullWidth
                    size="lg"
                    variant="gradient"
                  />
                </GlassSurface>
              )}
            </Animated.View>

            <Animated.View style={[styles.footer, entranceStyle]}>
              <Link href="/(auth)/login" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.footerLink}>Back to sign in</Text>
                </Pressable>
              </Link>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  heroTitle: {
    ...typography.display,
    fontSize: 32,
    color: '#ffffff',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.82)',
  },
  formCard: {
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  successCard: {
    padding: spacing.xl,
    marginBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: borderRadius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  successDescription: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  footerLink: {
    ...typography.body,
    color: '#ffffff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
