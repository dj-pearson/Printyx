/**
 * Avatar
 *
 * User avatar with initials fallback. Initials tile uses a subtle
 * brand gradient for better visual appeal.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, shadows } from '@/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  withRing?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ uri, name = '?', size = 40, withRing = false }: AvatarProps) {
  const ring = withRing ? { padding: 2, backgroundColor: '#fff', ...shadows.sm, borderRadius: size } : null;

  if (uri) {
    return (
      <View style={ring}>
        <Image
          source={{ uri }}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
          contentFit="cover"
          accessibilityLabel={`${name} avatar`}
        />
      </View>
    );
  }

  const initials = getInitials(name);

  return (
    <View style={ring}>
      <LinearGradient
        colors={gradients.brand as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.initialsContainer,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        accessibilityLabel={`${name} avatar`}
      >
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.gray[200],
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
