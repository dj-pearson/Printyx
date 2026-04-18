/**
 * GlassSurface
 *
 * Foundational glassmorphism primitive used by cards, sheets, tab bars,
 * and headers. Combines a native UIBlurEffect (BlurView) with a translucent
 * gradient sheen and a thin highlight border.
 *
 * Falls back to a semi-transparent tinted background on platforms where
 * BlurView isn't available (primarily react-native-web).
 */

import React from 'react';
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, glass, gradients, shadows } from '@/theme';

export type GlassTone = 'light' | 'tinted' | 'chrome' | 'dark';
export type GlassElevation = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface GlassSurfaceProps extends ViewProps {
  /** Amount of background blur. Higher = frostier. */
  intensity?: number;
  /** Brand tone for the glass fill. */
  tone?: GlassTone;
  /** Rounded corner radius. */
  radius?: number;
  /** Drop shadow elevation. */
  elevation?: GlassElevation;
  /** Layer an additional subtle gradient sheen across the surface. */
  withSheen?: boolean;
  /** Draw the thin highlight border common to iOS glass surfaces. */
  withBorder?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

const toneToTint = (tone: GlassTone) => {
  switch (tone) {
    case 'dark':
      return glass.tint.dark;
    case 'chrome':
      return glass.tint.systemChromeMaterial;
    case 'tinted':
      return glass.tint.systemThinMaterial;
    case 'light':
    default:
      return glass.tint.systemMaterial;
  }
};

const toneToFallback = (tone: GlassTone) => {
  switch (tone) {
    case 'dark':
      return glass.fallback.dark;
    case 'tinted':
      return glass.fallback.tinted;
    case 'chrome':
    case 'light':
    default:
      return glass.fallback.light;
  }
};

const toneToSheen = (tone: GlassTone) => {
  switch (tone) {
    case 'dark':
      return gradients.glassDark;
    case 'tinted':
      return gradients.glassTinted;
    case 'chrome':
    case 'light':
    default:
      return gradients.glassLight;
  }
};

export function GlassSurface({
  intensity = glass.intensity.regular,
  tone = 'light',
  radius = borderRadius.xl,
  elevation = 'md',
  withSheen = true,
  withBorder = true,
  children,
  style,
  ...rest
}: GlassSurfaceProps) {
  const shadowStyle = elevation === 'none' ? null : shadows[elevation];
  const borderStyle = withBorder
    ? {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tone === 'dark' ? glass.border.dark : glass.border.light,
      }
    : null;

  // BlurView isn't supported on react-native-web in the same way.
  if (Platform.OS === 'web') {
    return (
      <View
        {...rest}
        style={[
          styles.container,
          shadowStyle,
          {
            borderRadius: radius,
            backgroundColor: toneToFallback(tone),
            backdropFilter: `blur(${intensity * 0.4}px) saturate(180%)`,
            WebkitBackdropFilter: `blur(${intensity * 0.4}px) saturate(180%)`,
          } as unknown as ViewStyle,
          borderStyle,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      {...rest}
      style={[styles.container, shadowStyle, { borderRadius: radius }, style]}
    >
      <BlurView
        intensity={intensity}
        tint={toneToTint(tone)}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
      />
      {withSheen && (
        <LinearGradient
          colors={toneToSheen(tone)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius, opacity: 0.9 }]}
        />
      )}
      {borderStyle && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radius },
            borderStyle,
          ]}
        />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  content: {
    flex: 0,
  },
});
