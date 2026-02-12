/**
 * Reports Screen
 *
 * Report hub with categorized reports and quick access to key metrics.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, StatCard, EmptyState } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

const REPORT_CATEGORIES = [
  { key: 'sales', title: 'Sales Reports', icon: 'chart-line' as const, color: colors.primary[600] },
  { key: 'service', title: 'Service Reports', icon: 'wrench' as const, color: colors.warning.main },
  { key: 'financial', title: 'Financial Reports', icon: 'currency-usd' as const, color: colors.success.main },
  { key: 'equipment', title: 'Equipment Reports', icon: 'printer' as const, color: colors.info.main },
  { key: 'performance', title: 'Performance Reports', icon: 'speedometer' as const, color: '#8b5cf6' },
  { key: 'custom', title: 'Custom Reports', icon: 'file-chart' as const, color: colors.gray[600] },
];

export default function ReportsScreen() {
  const { data: reports } = useQuery<any[]>({
    queryKey: ['/api/reports'],
  });

  const { data: kpis } = useQuery({
    queryKey: ['/api/analytics/performance-metrics'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Reports</Text>

        {/* KPI Overview */}
        <View style={styles.kpiRow}>
          <StatCard
            title="Revenue MTD"
            value={kpis?.revenueMtd ? `$${Number(kpis.revenueMtd).toLocaleString()}` : '--'}
            icon="currency-usd"
            iconColor={colors.success.main}
          />
          <StatCard
            title="Close Rate"
            value={kpis?.closeRate ? `${kpis.closeRate}%` : '--'}
            icon="percent"
            iconColor={colors.primary[600]}
          />
        </View>

        {/* Report Categories */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.categoryGrid}>
          {REPORT_CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat.key} style={styles.categoryCard} activeOpacity={0.7}>
              <View style={[styles.categoryIcon, { backgroundColor: cat.color + '15' }]}>
                <MaterialCommunityIcons name={cat.icon} size={28} color={cat.color} />
              </View>
              <Text style={styles.categoryTitle}>{cat.title}</Text>
              <Text style={styles.categoryCount}>
                {Array.isArray(reports)
                  ? reports.filter((r: any) => r.category === cat.key).length
                  : 0}{' '}
                reports
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Reports */}
        {Array.isArray(reports) && reports.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            <Card padded={false}>
              {reports.slice(0, 5).map((report: any, i: number) => (
                <TouchableOpacity
                  key={report.id}
                  style={[styles.reportRow, i > 0 && styles.reportBorder]}
                  activeOpacity={0.7}
                  onLongPress={() => {
                    Share.share({ message: `Report: ${report.name || report.title}` });
                  }}
                >
                  <MaterialCommunityIcons name="file-chart-outline" size={20} color={colors.gray[400]} />
                  <View style={styles.reportInfo}>
                    <Text style={styles.reportName} numberOfLines={1}>{report.name || report.title}</Text>
                    <Text style={styles.reportDate}>
                      {report.lastRunAt ? new Date(report.lastRunAt).toLocaleDateString() : 'Never run'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray[300]} />
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.xl },
  kpiRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  sectionTitle: { ...typography.h4, color: colors.text.primary, marginBottom: spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  categoryCard: {
    width: '47%', backgroundColor: colors.background.default,
    borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.sm,
  },
  categoryIcon: { width: 48, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  categoryTitle: { ...typography.bodySmall, fontWeight: '600', color: colors.text.primary },
  categoryCount: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  reportRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 56,
  },
  reportBorder: { borderTopWidth: 1, borderTopColor: colors.gray[100] },
  reportInfo: { flex: 1 },
  reportName: { ...typography.body, color: colors.text.primary },
  reportDate: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
});
