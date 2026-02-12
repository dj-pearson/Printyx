/**
 * Settings Screen
 *
 * Profile, preferences, support, and account management.
 * Includes account deletion (required by Apple & Google).
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ListItem, Card, Avatar, Button } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { colors, spacing, typography } from '@/theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const fullName = [
    user?.user_metadata?.firstName,
    user?.user_metadata?.lastName,
  ].filter(Boolean).join(' ') || 'User';

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar name={fullName} size={56} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{fullName}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileRole}>
                {user?.app_metadata?.role || 'User'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Account Section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <Card padded={false}>
          <ListItem
            title="Edit Profile"
            icon="account-edit"
            iconColor={colors.primary[600]}
            onPress={() => {/* Navigate to profile edit */}}
          />
          <View style={styles.divider} />
          <ListItem
            title="Change Password"
            icon="lock-reset"
            iconColor={colors.warning.main}
            onPress={() => {/* Navigate to password change */}}
          />
          <View style={styles.divider} />
          <ListItem
            title="Notification Settings"
            icon="bell-cog"
            iconColor={colors.info.main}
            onPress={() => {/* Navigate to notification preferences */}}
          />
        </Card>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Support</Text>
        <Card padded={false}>
          <ListItem
            title="Help Center"
            icon="help-circle"
            iconColor={colors.primary[600]}
            onPress={() => Linking.openURL('https://printyx.net/help')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Contact Support"
            icon="email-fast"
            iconColor={colors.info.main}
            onPress={() => Linking.openURL('mailto:support@printyx.net')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Report a Bug"
            icon="bug"
            iconColor={colors.error.main}
            onPress={() => Linking.openURL('mailto:bugs@printyx.net?subject=Bug%20Report%20-%20Mobile%20App')}
          />
        </Card>

        {/* Legal Section */}
        <Text style={styles.sectionTitle}>Legal</Text>
        <Card padded={false}>
          <ListItem
            title="Privacy Policy"
            icon="shield-lock"
            iconColor={colors.gray[600]}
            onPress={() => Linking.openURL('https://printyx.net/privacy')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Terms of Service"
            icon="file-document"
            iconColor={colors.gray[600]}
            onPress={() => Linking.openURL('https://printyx.net/terms')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Licenses"
            icon="license"
            iconColor={colors.gray[600]}
            onPress={() => {}}
          />
        </Card>

        {/* Danger Zone */}
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <Card padded={false}>
          <ListItem
            title="Delete Account"
            icon="account-remove"
            iconColor={colors.error.main}
            showChevron={false}
            onPress={handleDeleteAccount}
          />
        </Card>

        {/* Sign Out */}
        <View style={styles.signOutSection}>
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="outline"
            fullWidth
          />
        </View>

        {/* App Version */}
        <Text style={styles.version}>
          Printyx Mobile v{Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.xl },
  profileCard: { marginBottom: spacing.xl },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileInfo: { flex: 1 },
  profileName: { ...typography.h3, color: colors.text.primary },
  profileEmail: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 2 },
  profileRole: { ...typography.caption, color: colors.primary[600], marginTop: 2, textTransform: 'capitalize' },
  sectionTitle: { ...typography.bodySmall, fontWeight: '600', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  divider: { height: 1, backgroundColor: colors.gray[100], marginLeft: spacing.lg + 36 + spacing.md },
  signOutSection: { marginTop: spacing['2xl'] },
  version: { ...typography.caption, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xl },
});
