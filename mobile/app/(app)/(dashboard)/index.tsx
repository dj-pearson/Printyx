/**
 * Dashboard Screen
 *
 * Glassmorphism hero with an animated gradient, greeting + avatar,
 * a featured revenue hero tile, a 2x2 stat grid, quick-action pills,
 * and a translucent recent-activity card. Scroll drives a collapsing
 * header via a shared scroll value.
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar,
  Badge,
  GlassCard,
  GlassHeader,
  GradientBackground,
  SectionHeader,
  Skeleton,
  StatCard,
} from '@/components/ui';
import {
  borderRadius,
  colors,
  gradients,
  shadows,
  spacing,
  typography,
} from '@/theme';

interface DashboardData {
  openLeads?: number | string;
  activeTickets?: number | string;
  revenueMtd?: number | string;
  totalEquipment?: number | string;
  revenueTrend?: number;
  leadsTrend?: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const scrollY = useSharedValue(0);

  const { data: dashboardData, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ['/api/mobile/dashboard'],
    enabled: !!user,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['/api/activities/recent'],
    enabled: !!user,
  });

  const firstName = useMemo(
    () =>
      user?.user_metadata?.firstName ||
      user?.email?.split('@')[0] ||
      'there',
    [user],
  );
  const fullName =
    `${user?.user_metadata?.firstName || ''} ${user?.user_metadata?.lastName || ''}`.trim() ||
    firstName;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Parallax gradient header — drifts upward as we scroll
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 240],
          [0, -60],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollY.value,
          [-120, 0, 240],
          [1.15, 1, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const greetingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, 80],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 80],
          [0, -10],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const revenueMtd = dashboardData?.revenueMtd;
  const revenueFormatted =
    typeof revenueMtd === 'number' || (typeof revenueMtd === 'string' && revenueMtd)
      ? `$${Number(revenueMtd).toLocaleString()}`
      : '$—';

  const activity = Array.isArray(recentActivity) ? recentActivity : [];

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[styles.hero, heroStyle]}
      >
        <GradientBackground variant="hero" withOrbs />
      </Animated.View>

      <GlassHeader title={fullName} subtitle="Dashboard" scrollY={scrollY} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#ffffff"
            />
          }
        >
          <Animated.View style={[styles.greetingRow, greetingStyle]}>
            <View style={styles.greetingText}>
              <Text style={styles.greetingLabel}>
                Good {getTimeOfDay()},
              </Text>
              <Text style={styles.greetingName} numberOfLines={1}>
                {firstName}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(app)/(settings)');
              }}
              accessibilityLabel="Profile and settings"
              accessibilityRole="button"
              hitSlop={10}
            >
              <Avatar name={fullName} size={48} withRing />
            </Pressable>
          </Animated.View>

          <HeroRevenueCard
            value={revenueFormatted}
            trend={dashboardData?.revenueTrend ?? 8}
            isLoading={isLoading}
            onPress={() => router.push('/(app)/(reports)')}
          />

          <View style={styles.statsGrid}>
            {isLoading ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title="Open Leads"
                  value={dashboardData?.openLeads ?? '--'}
                  icon="account-plus-outline"
                  iconColor={colors.primary[600]}
                  trend={{ value: dashboardData?.leadsTrend ?? 12, isPositive: true }}
                  onPress={() => router.push('/(app)/(crm)/leads')}
                  delay={40}
                />
                <StatCard
                  title="Active Tickets"
                  value={dashboardData?.activeTickets ?? '--'}
                  icon="ticket-confirmation-outline"
                  iconColor={colors.warning.main}
                  onPress={() => router.push('/(app)/(service)/tickets')}
                  delay={120}
                />
              </>
            )}
          </View>

          <View style={styles.statsGrid}>
            {isLoading ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title="Installed Fleet"
                  value={dashboardData?.totalEquipment ?? '--'}
                  icon="printer-outline"
                  iconColor={colors.accent[600]}
                  onPress={() => router.push('/(app)/(equipment)')}
                  delay={200}
                />
                <StatCard
                  title="Today's Tasks"
                  value={dashboardData?.activeTickets ?? '--'}
                  icon="checkbox-marked-circle-outline"
                  iconColor={colors.success.main}
                  delay={280}
                />
              </>
            )}
          </View>

          <View style={styles.section}>
            <SectionHeader
              title="Quick Actions"
              overline="Jump back in"
            />
            <View style={styles.actionsGrid}>
              <QuickAction
                icon="account-plus-outline"
                label="New Lead"
                gradient={['#3b82f6', '#6366f1']}
                onPress={() => router.push('/(app)/(crm)/leads')}
              />
              <QuickAction
                icon="ticket-confirmation-outline"
                label="New Ticket"
                gradient={['#f59e0b', '#ef4444']}
                onPress={() => router.push('/(app)/(service)/tickets')}
              />
              <QuickAction
                icon="file-document-edit-outline"
                label="Quote"
                gradient={['#8b5cf6', '#ec4899']}
                onPress={() => router.push('/(app)/(crm)/deals')}
              />
              <QuickAction
                icon="barcode-scan"
                label="Scan"
                gradient={['#22c55e', '#0ea5e9']}
                onPress={() => router.push('/(app)/(equipment)')}
              />
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader
              title="Recent Activity"
              actionLabel="See all"
              onActionPress={() => router.push('/(app)/(reports)')}
            />
            <GlassCard tone="light" padded={false}>
              {activity.length === 0 ? (
                <View style={styles.emptyActivity}>
                  <MaterialCommunityIcons
                    name="bell-outline"
                    size={28}
                    color={colors.gray[400]}
                  />
                  <Text style={styles.emptyActivityText}>
                    No recent activity yet
                  </Text>
                </View>
              ) : (
                activity.slice(0, 5).map((item: any, index: number) => (
                  <View
                    key={item.id || index}
                    style={[
                      styles.activityRow,
                      index > 0 && styles.activityDivider,
                    ]}
                  >
                    <View style={styles.activityDot} />
                    <View style={styles.activityContent}>
                      <Text style={styles.activityText} numberOfLines={2}>
                        {item.description || item.title}
                      </Text>
                      <View style={styles.activityMeta}>
                        {item.type ? (
                          <Badge
                            label={String(item.type)}
                            variant="info"
                            size="sm"
                          />
                        ) : null}
                        <Text style={styles.activityTime}>
                          {item.createdAt
                            ? formatRelative(new Date(item.createdAt))
                            : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </GlassCard>
          </View>

          <View style={styles.bottomSpacer} />
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

function HeroRevenueCard({
  value,
  trend,
  isLoading,
  onPress,
}: {
  value: string;
  trend: number;
  isLoading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Revenue month to date ${value}`}
      style={({ pressed }) => [
        styles.revenueCard,
        shadows.glow,
        pressed && { opacity: 0.92 },
      ]}
    >
      <LinearGradient
        colors={gradients.brandDawn as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.revenueSurface}
      >
        <View style={styles.revenueTop}>
          <Text style={styles.revenueLabel}>Revenue · MTD</Text>
          <Badge
            label={`${trend >= 0 ? '+' : ''}${trend}%`}
            variant="gradient"
            gradient="success"
            icon="trending-up"
            size="sm"
          />
        </View>
        {isLoading ? (
          <Skeleton height={38} width="60%" radius={10} style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        ) : (
          <Text style={styles.revenueValue} numberOfLines={1}>
            {value}
          </Text>
        )}
        <View style={styles.revenueFooter}>
          <MaterialCommunityIcons
            name="chart-line-variant"
            size={16}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.revenueFooterText}>
            Tap to view revenue reports
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  gradient,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  gradient: [string, string];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.quickAction,
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.quickActionIcon}
      >
        <MaterialCommunityIcons name={icon} size={24} color="#ffffff" />
      </LinearGradient>
      <Text style={styles.quickActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatSkeleton() {
  return (
    <View style={styles.statSkeleton}>
      <Skeleton height={40} width={40} radius={12} />
      <Skeleton height={28} width="70%" radius={6} style={{ marginTop: 14 }} />
      <Skeleton height={14} width="50%" radius={4} style={{ marginTop: 6 }} />
    </View>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.canvas,
  },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['4xl'],
    paddingBottom: 140,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  greetingText: {
    flex: 1,
    marginRight: spacing.md,
  },
  greetingLabel: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.82)',
  },
  greetingName: {
    ...typography.display,
    color: '#ffffff',
  },
  revenueCard: {
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  revenueSurface: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  revenueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueLabel: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
  },
  revenueValue: {
    ...typography.display,
    color: '#ffffff',
  },
  revenueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  revenueFooterText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statSkeleton: {
    flex: 1,
    minHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  section: {
    marginTop: spacing.xl,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  quickActionLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  activityDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.3)',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
    marginTop: 7,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '500',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  activityTime: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: 6,
  },
  emptyActivityText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
