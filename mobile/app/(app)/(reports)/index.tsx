/**
 * Reports Screen
 *
 * Report hub with KPI overview, categorized reports via glass tiles,
 * and a translucent list of recent reports.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  GlassCard,
  SectionHeader,
  StatCard,
} from '@/components/ui';
import { borderRadius, colors, spacing, typography } from '@/theme';

const REPORT_CATEGORIES = [
  {
    key: 'sales',
    title: 'Sales',
    icon: 'chart-line' as const,
    color: colors.primary[600],
    bg: colors.primary[50],
  },
  {
    key: 'service',
    title: 'Service',
    icon: 'wrench-outline' as const,
    color: colors.warning.main,
    bg: colors.warning.light,
  },
  {
    key: 'financial',
    title: 'Financial',
    icon: 'currency-usd' as const,
    color: colors.success.main,
    bg: colors.success.light,
  },
  {
    key: 'equipment',
    title: 'Equipment',
    icon: 'printer-outline' as const,
    color: colors.info.main,
    bg: colors.info.light,
  },
  {
    key: 'performance',
    title: 'Performance',
    icon: 'speedometer' as const,
    color: colors.accent[600],
    bg: colors.accent[50],
  },
  {
    key: 'custom',
    title: 'Custom',
    icon: 'file-chart-outline' as const,
    color: colors.gray[600],
    bg: colors.gray[100],
  },
];

export default function ReportsScreen() {
  const { data: reports } = useQuery<any[]>({
    queryKey: ['/api/reports'],
  });

  const { data: kpis } = useQuery<any>({
    queryKey: ['/api/analytics/performance-metrics'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>
          Insights, KPIs, and exports across your operation.
        </Text>

        <View style={styles.kpiRow}>
          <StatCard
            title="Revenue MTD"
            value={
              kpis?.revenueMtd
                ? `$${Number(kpis.revenueMtd).toLocaleString()}`
                : '--'
            }
            icon="currency-usd"
            iconColor={colors.success.main}
            variant="hero"
            gradient="success"
            delay={40}
          />
        </View>

        <View style={styles.kpiRow}>
          <StatCard
            title="Close Rate"
            value={kpis?.closeRate ? `${kpis.closeRate}%` : '--'}
            icon="percent"
            iconColor={colors.primary[600]}
            delay={120}
          />
          <StatCard
            title="Avg Ticket Time"
            value={kpis?.avgTicketTime ? `${kpis.avgTicketTime}h` : '--'}
            icon="clock-outline"
            iconColor={colors.accent[600]}
            delay={200}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Categories" overline="Explore reports" />
          <View style={styles.categoryGrid}>
            {REPORT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                onPress={() =>
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }
                accessibilityRole="button"
                accessibilityLabel={`${cat.title} reports`}
                style={({ pressed }) => [
                  styles.categoryCard,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
                ]}
              >
                <GlassCard tone="light" padded>
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: cat.bg },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon}
                      size={24}
                      color={cat.color}
                    />
                  </View>
                  <Text style={styles.categoryTitle}>{cat.title}</Text>
                  <Text style={styles.categoryCount}>
                    {Array.isArray(reports)
                      ? reports.filter((r: any) => r.category === cat.key).length
                      : 0}{' '}
                    reports
                  </Text>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </View>

        {Array.isArray(reports) && reports.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Recent Reports"
              actionLabel="See all"
              onActionPress={() => {}}
            />
            <GlassCard tone="light" padded={false}>
              {reports.slice(0, 5).map((report: any, i: number) => (
                <Pressable
                  key={report.id}
                  style={({ pressed }) => [
                    styles.reportRow,
                    i > 0 && styles.reportBorder,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() =>
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Share.share({ message: `Report: ${report.name || report.title}` });
                  }}
                >
                  <MaterialCommunityIcons
                    name="file-chart-outline"
                    size={22}
                    color={colors.primary[600]}
                  />
                  <View style={styles.reportInfo}>
                    <Text style={styles.reportName} numberOfLines={1}>
                      {report.name || report.title}
                    </Text>
                    <Text style={styles.reportDate}>
                      {report.lastRunAt
                        ? new Date(report.lastRunAt).toLocaleDateString()
                        : 'Never run'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.gray[400]}
                  />
                </Pressable>
              ))}
            </GlassCard>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.canvas },
  content: { padding: spacing.lg, paddingBottom: 140 },
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
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  categoryCard: {
    width: '47.5%',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  categoryTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  categoryCount: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  reportBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.25)',
  },
  reportInfo: { flex: 1 },
  reportName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  reportDate: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
