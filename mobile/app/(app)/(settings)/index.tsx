/**
 * Settings Screen
 *
 * Profile, preferences, support, and account management. Uses the same
 * modern glass aesthetic as the rest of the app.
 */

import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar,
  Badge,
  Button,
  Card,
  GlassCard,
  ListItem,
  SectionHeader,
} from '@/components/ui';
import {
  borderRadius,
  colors,
  gradients,
  spacing,
  typography,
} from '@/theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  const fullName =
    [user?.user_metadata?.firstName, user?.user_metadata?.lastName]
      .filter(Boolean)
      .join(' ') || 'User';

  const role = user?.app_metadata?.role || 'Team member';
  const tenant = user?.app_metadata?.tenantName as string | undefined;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Type DELETE to confirm account deletion. Please contact support at support@printyx.net to complete account deletion.',
              [{ text: 'OK' }],
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Settings</Text>

        <LinearGradient
          colors={gradients.brand as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileCard}
        >
          <View style={styles.profileRow}>
            <Avatar name={fullName} size={64} withRing />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {fullName}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.email}
              </Text>
              <View style={styles.profileBadges}>
                <Badge label={String(role)} variant="gradient" gradient="success" size="sm" />
                {tenant ? (
                  <Badge label={tenant} variant="outline" size="sm" />
                ) : null}
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <SectionHeader title="Account" />
          <GlassCard tone="light" padded={false}>
            <ListItem
              title="Edit Profile"
              subtitle="Update your name, photo, and contact info"
              icon="account-edit-outline"
              iconColor={colors.primary[600]}
              iconBackground={colors.primary[50]}
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <ListItem
              title="Change Password"
              subtitle="Update your account password"
              icon="lock-reset"
              iconColor={colors.warning.main}
              iconBackground={colors.warning.light}
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <ListItem
              title="Notifications"
              subtitle="Push, email, and in-app alerts"
              icon="bell-ring-outline"
              iconColor={colors.info.main}
              iconBackground={colors.info.light}
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <ListItem
              title="Appearance"
              subtitle="Light, dark, system"
              icon="palette-outline"
              iconColor={colors.accent[600]}
              iconBackground={colors.accent[50]}
              onPress={() => {}}
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Support" />
          <GlassCard tone="light" padded={false}>
            <ListItem
              title="Help Center"
              icon="help-circle-outline"
              iconColor={colors.primary[600]}
              iconBackground={colors.primary[50]}
              onPress={() => Linking.openURL('https://printyx.net/help')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Contact Support"
              icon="email-fast-outline"
              iconColor={colors.info.main}
              iconBackground={colors.info.light}
              onPress={() => Linking.openURL('mailto:support@printyx.net')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Report a Bug"
              icon="bug-outline"
              iconColor={colors.error.main}
              iconBackground={colors.error.light}
              onPress={() =>
                Linking.openURL(
                  'mailto:bugs@printyx.net?subject=Bug%20Report%20-%20Mobile%20App',
                )
              }
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Legal" />
          <GlassCard tone="light" padded={false}>
            <ListItem
              title="Privacy Policy"
              icon="shield-lock-outline"
              iconColor={colors.gray[600]}
              iconBackground={colors.gray[100]}
              onPress={() => Linking.openURL('https://printyx.net/privacy')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Terms of Service"
              icon="file-document-outline"
              iconColor={colors.gray[600]}
              iconBackground={colors.gray[100]}
              onPress={() => Linking.openURL('https://printyx.net/terms')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Licenses"
              icon="license"
              iconColor={colors.gray[600]}
              iconBackground={colors.gray[100]}
              onPress={() => {}}
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Danger Zone" />
          <Card variant="outlined" padded={false}>
            <ListItem
              title="Delete Account"
              subtitle="Permanently erase your data"
              icon="account-remove-outline"
              showChevron={false}
              destructive
              onPress={handleDeleteAccount}
            />
          </Card>
        </View>

        <View style={styles.signOutSection}>
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="outline"
            fullWidth
            size="lg"
            haptic="heavy"
          />
        </View>

        <Text style={styles.version}>
          Printyx · v{Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.canvas,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 140,
  },
  screenTitle: {
    ...typography.display,
    fontSize: 34,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  profileCard: {
    padding: spacing.lg,
    borderRadius: borderRadius['2xl'],
    marginBottom: spacing.xl,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    ...typography.h3,
    color: '#ffffff',
  },
  profileEmail: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
  },
  profileBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  section: {
    marginTop: spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.25)',
    marginLeft: spacing.lg + 40 + spacing.md,
  },
  signOutSection: {
    marginTop: spacing.xl,
  },
  version: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
