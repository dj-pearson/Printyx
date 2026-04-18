/**
 * Signup Screen
 *
 * Account creation with company info. Matches the login screen's branded
 * aesthetic — animated gradient backdrop, glass form surface, haptic CTA.
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
  spacing,
  typography,
} from '@/theme';

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  companyName: z.string().min(1, 'Company name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  phone: z.string().optional(),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const { signup } = useAuth();
  const router = useRouter();
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
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      companyName: '',
      email: '',
      password: '',
      phone: '',
    },
  });

  const onSubmit = useCallback(
    async (data: SignupForm) => {
      setIsSubmitting(true);
      try {
        const result = await signup(data);
        if (result.error) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Signup Failed', result.error);
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
    [signup],
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
              <Text style={styles.heroTitle}>Create your account</Text>
              <Text style={styles.heroSubtitle}>
                Start managing your copier business with Printyx.
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
                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Controller
                      control={control}
                      name="firstName"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="First name"
                          placeholder="John"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          error={errors.firstName?.message}
                          autoComplete="given-name"
                          textContentType="givenName"
                          required
                        />
                      )}
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Controller
                      control={control}
                      name="lastName"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="Last name"
                          placeholder="Doe"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          error={errors.lastName?.message}
                          autoComplete="family-name"
                          textContentType="familyName"
                          required
                        />
                      )}
                    />
                  </View>
                </View>

                <Controller
                  control={control}
                  name="companyName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Company name"
                      placeholder="Acme Copier Solutions"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.companyName?.message}
                      leadingIcon="domain"
                      autoComplete="organization"
                      textContentType="organizationName"
                      required
                    />
                  )}
                />

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

                <Controller
                  control={control}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Phone"
                      placeholder="(555) 123-4567"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.phone?.message}
                      leadingIcon="phone-outline"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Password"
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.password?.message}
                      leadingIcon="lock-outline"
                      secureTextEntry
                      autoComplete="password-new"
                      textContentType="newPassword"
                      helperText="Use a strong password you haven't used elsewhere."
                      required
                    />
                  )}
                />

                <Button
                  title="Create account"
                  onPress={handleSubmit(onSubmit)}
                  loading={isSubmitting}
                  fullWidth
                  size="lg"
                  variant="gradient"
                />
              </GlassSurface>
            </Animated.View>

            <Animated.View style={[styles.footer, entranceStyle]}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.footerLink}>Sign in</Text>
                </Pressable>
              </Link>
            </Animated.View>

            <Text style={styles.legal}>
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </Text>
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
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  legal: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
});
