/**
 * Login Screen
 *
 * Branded welcome experience with an animated gradient backdrop,
 * a frosted glass form surface, and smooth entrance motion.
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
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
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
  motion,
  shadows,
  spacing,
  typography,
} from '@/theme';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = useCallback(
    async (data: LoginForm) => {
      setIsSubmitting(true);
      try {
        const result = await login(data.email, data.password);
        if (result.error) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Login Failed', result.error);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [login],
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
            <Animated.View style={[styles.hero, entranceStyle]}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoLetter}>P</Text>
              </View>
              <Text style={styles.heroTitle}>Welcome back</Text>
              <Text style={styles.heroSubtitle}>
                Sign in to manage your print operations with Printyx.
              </Text>
            </Animated.View>

            <Animated.View style={entranceStyle}>
              <GlassSurface
                tone="light"
                intensity={70}
                radius={borderRadius['2xl']}
                elevation="xl"
                style={styles.formCard}
              >
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
                        returnKeyType="next"
                        leadingIcon="email-outline"
                        required
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Password"
                        placeholder="Enter your password"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.password?.message}
                        secureTextEntry
                        autoComplete="password"
                        textContentType="password"
                        returnKeyType="done"
                        leadingIcon="lock-outline"
                        onSubmitEditing={handleSubmit(onSubmit)}
                        required
                      />
                    )}
                  />

                  <Link href="/(auth)/forgot-password" asChild>
                    <Pressable
                      accessibilityRole="link"
                      style={({ pressed }) => [
                        styles.forgotWrap,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={styles.forgotPassword}>Forgot password?</Text>
                    </Pressable>
                  </Link>

                  <Button
                    title="Sign In"
                    onPress={handleSubmit(onSubmit)}
                    loading={isSubmitting}
                    fullWidth
                    size="lg"
                    variant="gradient"
                  />
                </View>
              </GlassSurface>
            </Animated.View>

            <Animated.View style={[styles.footer, entranceStyle]}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/signup" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.footerLink}>Create one</Text>
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
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['2xl'],
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: borderRadius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  logoLetter: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroTitle: {
    ...typography.display,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    maxWidth: 320,
  },
  formCard: {
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  form: {
    gap: 0,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  forgotPassword: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.82)',
  },
  footerLink: {
    ...typography.body,
    color: '#ffffff',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
