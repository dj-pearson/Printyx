/**
 * CRM Hub Screen
 *
 * Navigation hub for all CRM features: Leads, Customers, Contacts, Deals.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ListItem, Card, StatCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export default function CRMHubScreen() {
  const router = useRouter();

  const { data: stats } = useQuery({
    queryKey: ['/api/business-records/stats'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>CRM</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            title="Leads"
            value={stats?.leads ?? '--'}
            icon="account-plus"
            iconColor={colors.primary[600]}
          />
          <StatCard
            title="Customers"
            value={stats?.customers ?? '--'}
            icon="account-check"
            iconColor={colors.success.main}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            title="Open Deals"
            value={stats?.deals ?? '--'}
            icon="handshake"
            iconColor={colors.warning.main}
          />
          <StatCard
            title="Contacts"
            value={stats?.contacts ?? '--'}
            icon="contacts"
            iconColor={colors.info.main}
          />
        </View>

        {/* Navigation */}
        <Card style={styles.navCard}>
          <ListItem
            title="Leads"
            subtitle="Manage prospects and lead pipeline"
            icon="account-plus"
            iconColor={colors.primary[600]}
            onPress={() => router.push('/(app)/(crm)/leads')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Customers"
            subtitle="Active customer accounts"
            icon="account-check"
            iconColor={colors.success.main}
            onPress={() => router.push('/(app)/(crm)/customers')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Contacts"
            subtitle="All business contacts"
            icon="contacts"
            iconColor={colors.info.main}
            onPress={() => router.push('/(app)/(crm)/contacts')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Deals & Quotes"
            subtitle="Opportunities and proposals"
            icon="handshake"
            iconColor={colors.warning.main}
            onPress={() => router.push('/(app)/(crm)/deals')}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  navCard: {
    marginTop: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginLeft: spacing.lg + 36 + spacing.md,
  },
});
