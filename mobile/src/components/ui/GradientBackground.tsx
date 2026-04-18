/**
 * GradientBackground
 *
 * Brand-aware ambient background. Used on auth screens, dashboard heroes,
 * and anywhere we want the UI to feel alive. Accepts either a named gradient
 * from the theme or custom colors, plus optional decorative orbs.
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientKey, gradients } from '@/theme';

interface GradientBackgroundProps {
  /** Named gradient key from the theme (preferred). */
  variant?: GradientKey;
  /** Custom gradient colors (overrides variant). */
  colors?: readonly [string, string, ...string[]];
  /** Gradient start coord (0-1). */
  start?: { x: number; y: number };
  /** Gradient end coord (0-1). */
  end?: { x: number; y: number };
  /** Decorative blurred orbs for extra depth. */
  withOrbs?: boolean;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

export function GradientBackground({
  variant = 'brand',
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  withOrbs = false,
  style,
  children,
}: GradientBackgroundProps) {
  const palette = (colors ?? gradients[variant]) as readonly [string, string, ...string[]];

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={palette as unknown as string[]}
        start={start}
        end={end}
        style={StyleSheet.absoluteFillObject}
      />
      {withOrbs && (
        <>
          <View style={[styles.orb, styles.orbOne]} />
          <View style={[styles.orb, styles.orbTwo]} />
          <View style={[styles.orb, styles.orbThree]} />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.35,
  },
  orbOne: {
    width: 320,
    height: 320,
    top: -80,
    right: -120,
    backgroundColor: '#a78bfa',
  },
  orbTwo: {
    width: 260,
    height: 260,
    bottom: -90,
    left: -80,
    backgroundColor: '#60a5fa',
  },
  orbThree: {
    width: 180,
    height: 180,
    top: '40%',
    left: '60%',
    backgroundColor: '#f472b6',
    opacity: 0.2,
  },
});
