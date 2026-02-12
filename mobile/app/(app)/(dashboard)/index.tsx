/**
 * Dashboard Screen
 *
 * Main dashboard showing key metrics, recent activity, and quick actions.
 * Data sourced from the same API endpoints as the web dashboard.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { StatCard, Card, Badge, Avatar } from '@/components/ui';
import { colors, spacing, typography, shadows, borderRadius } from '@/theme';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Fetch dashboard data
  const { data: dashboardData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['/api/mobile/dashboard'],
    enabled: !!user,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['/api/activities/recent'],
    enabled: !!user,
  });

  const firstName = user?.user_metadata?.firstName || user?.email?.split('@')[0] || 'User';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary[600]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/(settings)')}
            accessibilityLabel="Settings"
          >
            <Avatar
              name={`${user?.user_metadata?.firstName || ''} ${user?.user_metadata?.lastName || ''}`}
              size={44}
            />
          </TouchableOpacity>
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Open Leads"
              value={dashboardData?.openLeads ?? '--'}
              icon="account-plus"
              iconColor={colors.primary[600]}
              trend={{ value: 12, isPositive: true }}
            />
            <StatCard
              title="Active Tickets"
              value={dashboardData?.activeTickets ?? '--'}
              icon="ticket-outline"
              iconColor={colors.warning.main}
            />
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="Revenue MTD"
              value={dashboardData?.revenueMtd ? `$${Number(dashboardData.revenueMtd).toLocaleString()}` : '--'}
              icon="currency-usd"
              iconColor={colors.success.main}
              trend={{ value: 8, isPositive: true }}
            />
            <StatCard
              title="Equipment"
              value={dashboardData?.totalEquipment ?? '--'}
              icon="printer"
              iconColor={colors.info.main}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <QuickAction
              icon="account-plus"
              label="New Lead"
              onPress={() => router.push('/(app)/(crm)/leads')}
            />
            <QuickAction
              icon="ticket-plus"
              label="New Ticket"
              onPress={() => router.push('/(app)/(service)/tickets')}
            />
            <QuickAction
              icon="file-document-edit"
              label="New Quote"
              onPress={() => router.push('/(app)/(crm)/deals')}
            />
            <QuickAction
              icon="barcode-scan"
              label="Scan"
              onPress={() => router.push('/(app)/(equipment)')}
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Card>
            {Array.isArray(recentActivity) && recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity: any, index: number) => (
                <View key={activity.id || index} style={[styles.activityItem, index > 0 && styles.activityBorder]}>
                  <View style={styles.activityDot} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText} numberOfLines={2}>
                      {activity.description || activity.title}
                    </Text>
                    <Text style={styles.activityTime}>
                      {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : ''}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent activity</Text>
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} accessibilityLabel={label}>
      <View style={styles.actionIconContainer}>
        <MaterialCommunityIcons name={icon} size={24} color={colors.primary[600]} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.body,
    color: colors.text.secondary,
  },
  name: {
    ...typography.h2,
    color: colors.text.primary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  activityBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[400],
    marginTop: 6,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    ...typography.bodySmall,
    color: colors.text.primary,
  },
  activityTime: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
