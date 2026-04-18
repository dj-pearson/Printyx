/**
 * Skeleton
 *
 * Shimmering placeholder used while data is loading. Uses Reanimated
 * for a smooth, GPU-accelerated 1.6s loop.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { borderRadius, colors } from '@/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

export function Skeleton({ width = '100%', height = 16, radius = borderRadius.md, style }: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + progress.value * 0.35,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      style={[
        styles.base,
        { width: width as ViewStyle['width'], height, borderRadius: radius },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.shimmer, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.gray[100],
    overflow: 'hidden',
  },
  shimmer: {
    backgroundColor: colors.gray[200],
  },
});
