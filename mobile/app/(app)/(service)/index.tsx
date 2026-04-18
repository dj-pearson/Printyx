/**
 * Service Hub Screen
 *
 * Central hub for service operations: tickets, dispatch, field service.
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

export default function ServiceHubScreen() {
  const router = useRouter();

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/service-tickets/stats'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Service</Text>
        <Text style={styles.subtitle}>
          Tickets, dispatching, and field operations at a glance.
        </Text>

        <View style={styles.statsRow}>
          <StatCard
            title="Open Tickets"
            value={stats?.open ?? '--'}
            icon="ticket-confirmation-outline"
            iconColor={colors.warning.main}
            onPress={() => router.push('/(app)/(service)/tickets')}
            delay={40}
          />
          <StatCard
            title="In Progress"
            value={stats?.inProgress ?? '--'}
            icon="progress-wrench"
            iconColor={colors.info.main}
            delay={120}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            title="Completed"
            value={stats?.completedToday ?? '--'}
            icon="check-decagram-outline"
            iconColor={colors.success.main}
            delay={200}
          />
          <StatCard
            title="Overdue"
            value={stats?.overdue ?? '--'}
            icon="alert-decagram-outline"
            iconColor={colors.error.main}
            delay={280}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Operations" overline="Service workspace" />
          <GlassCard tone="light" padded={false}>
            <ListItem
              title="Service Tickets"
              subtitle="Queue, assignments, SLAs"
              icon="ticket-confirmation-outline"
              iconColor={colors.warning.main}
              iconBackground={colors.warning.light}
              onPress={() => router.push('/(app)/(service)/tickets')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Dispatch"
              subtitle="Route and assign technicians"
              icon="map-marker-path"
              iconColor={colors.primary[600]}
              iconBackground={colors.primary[50]}
              onPress={() => router.push('/(app)/(service)/dispatch')}
            />
            <View style={styles.divider} />
            <ListItem
              title="Field Service"
              subtitle="On-site mobile operations"
              icon="cellphone-link"
              iconColor={colors.success.main}
              iconBackground={colors.success.light}
              onPress={() => router.push('/(app)/(service)/field-service')}
            />
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.canvas },
  content: { padding: spacing.lg, paddingBottom: 140 },
  title: { ...typography.display, fontSize: 34, color: colors.text.primary },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  section: { marginTop: spacing.xl },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.25)',
    marginLeft: spacing.lg + 40 + spacing.md,
  },
});
