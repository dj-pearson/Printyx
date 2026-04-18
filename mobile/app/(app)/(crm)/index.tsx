/**
 * CRM Hub Screen
 *
 * Navigation hub for all CRM features: Leads, Customers, Contacts, Deals.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  GlassCard,
  ListItem,
  SectionHeader,
  StatCard,
} from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export default function CRMHubScreen() {
  const router = useRouter();

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/business-records/stats'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>CRM</Text>
        <Text style={styles.subtitle}>
          Track prospects, accounts, and deals — end to end.
        </Text>

        <View style={styles.statsRow}>
          <StatCard
            title="Leads"
            value={stats?.leads ?? '--'}
            icon="account-plus-outline"
            iconColor={colors.primary[600]}
            onPress={() => router.push('/(app)/(crm)/leads')}
            delay={40}
          />
          <StatCard
            title="Customers"
            value={stats?.customers ?? '--'}
            icon="account-check-outline"
            iconColor={colors.success.main}
            onPress={() => router.push('/(app)/(crm)/customers')}
            delay={120}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            title="Open Deals"
            value={stats?.deals ?? '--'}
            icon="handshake-outline"
            iconColor={colors.warning.main}
            onPress={() => router.push('/(app)/(crm)/deals')}
            delay={200}
          />
          <StatCard
            title="Contacts"
            value={stats?.contacts ?? '--'}
            icon="contacts-outline"
            iconColor={colors.info.main}
            onPress={() => router.push('/(app)/(crm)/contacts')}
            delay={280}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Pipeline" overline="Manage accounts" />
          <GlassCard tone="light" padded={false}>
            <ListItem
              title="Leads"
              subtitle="Prospects still qualifying"
              icon="account-plus-outline"
              iconColor={colors.primary[600]}
              iconBackground={colors.primary[50]}
              onPress={() => router.push('/(app)/(crm)/leads')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Customers"
              subtitle="Active customer accounts"
              icon="account-check-outline"
              iconColor={colors.success.main}
              iconBackground={colors.success.light}
              onPress={() => router.push('/(app)/(crm)/customers')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Contacts"
              subtitle="All business contacts"
              icon="contacts-outline"
              iconColor={colors.info.main}
              iconBackground={colors.info.light}
              onPress={() => router.push('/(app)/(crm)/contacts')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Deals & Quotes"
              subtitle="Opportunities and proposals"
              icon="handshake-outline"
              iconColor={colors.warning.main}
              iconBackground={colors.warning.light}
              onPress={() => router.push('/(app)/(crm)/deals')}
            />
          </GlassCard>
        </View>
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
  title: {
    ...typography.display,
    fontSize: 34,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.25)',
    marginLeft: spacing.lg + 40 + spacing.md,
  },
});
