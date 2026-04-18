/**
 * LoadingScreen
 *
 * Full-screen loading state with a branded pulsing logo mark and
 * optional message. Used during app warmup and between auth states.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  borderRadius,
  colors,
  gradients,
  spacing,
  typography,
} from '@/theme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const pulse = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse, glow]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glow.value * 0.4,
    transform: [{ scale: 1 + glow.value * 0.25 }],
  }));

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message || 'Loading'}
    >
      <View style={styles.logoStack}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={pulseStyle}>
          <LinearGradient
            colors={gradients.brand as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Text style={styles.logoLetter}>P</Text>
          </LinearGradient>
        </Animated.View>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.default,
    gap: spacing.xl,
  },
  logoStack: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[200],
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
  },
});
