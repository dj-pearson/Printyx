/**
 * Service Hub Screen
 *
 * Central hub for service operations: tickets, dispatch, field service.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ListItem, Card, StatCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export default function ServiceHubScreen() {
  const router = useRouter();

  const { data: stats } = useQuery({
    queryKey: ['/api/service-tickets/stats'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Service</Text>

        <View style={styles.statsRow}>
          <StatCard
            title="Open Tickets"
            value={stats?.open ?? '--'}
            icon="ticket-outline"
            iconColor={colors.warning.main}
          />
          <StatCard
            title="In Progress"
            value={stats?.inProgress ?? '--'}
            icon="progress-wrench"
            iconColor={colors.info.main}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            title="Completed Today"
            value={stats?.completedToday ?? '--'}
            icon="check-circle"
            iconColor={colors.success.main}
          />
          <StatCard
            title="Overdue"
            value={stats?.overdue ?? '--'}
            icon="alert-circle"
            iconColor={colors.error.main}
          />
        </View>

        <Card style={styles.navCard}>
          <ListItem
            title="Service Tickets"
            subtitle="View and manage all service tickets"
            icon="ticket-outline"
            iconColor={colors.warning.main}
            onPress={() => router.push('/(app)/(service)/tickets')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Service Dispatch"
            subtitle="Route and assign technicians"
            icon="map-marker-path"
            iconColor={colors.primary[600]}
            onPress={() => router.push('/(app)/(service)/dispatch')}
          />
          <View style={styles.divider} />
          <ListItem
            title="Field Service"
            subtitle="Mobile field operations"
            icon="cellphone-link"
            iconColor={colors.success.main}
            onPress={() => router.push('/(app)/(service)/field-service')}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { padding: spacing.lg },
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  navCard: { marginTop: spacing.lg },
  divider: { height: 1, backgroundColor: colors.gray[100], marginLeft: spacing.lg + 36 + spacing.md },
});
