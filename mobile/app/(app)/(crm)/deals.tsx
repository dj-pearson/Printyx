/**
 * Deals Screen
 *
 * Deal pipeline with visual cards representing deal stages.
 */

import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Badge, EmptyState } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

export default function DealsScreen() {
  const router = useRouter();

  const { data: rawDeals, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ['/api/deals', '?limit=50'],
  });
  // Handle both auto-unwrapped arrays and { data } / { records } response formats
  const deals: any[] = Array.isArray(rawDeals) ? rawDeals : (rawDeals?.data || rawDeals?.records || []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.dealCard}
      onPress={() => router.push({ pathname: '/(app)/(crm)/[id]', params: { id: item.id, type: 'deal' } })}
      activeOpacity={0.7}
    >
      <View style={styles.dealHeader}>
        <Text style={styles.dealTitle} numberOfLines={1}>{item.title || item.name}</Text>
        <Text style={styles.dealValue}>
          ${Number(item.value || item.amount || 0).toLocaleString()}
        </Text>
      </View>
      <Text style={styles.dealCompany} numberOfLines={1}>{item.companyName || item.customerName || '--'}</Text>
      <View style={styles.dealFooter}>
        <Badge
          label={item.stage || item.status || 'Prospect'}
          variant={getStageVariant(item.stage || item.status)}
        />
        {item.probability != null && (
          <Text style={styles.dealProbability}>{item.probability}% likely</Text>
        )}
      </View>
      {/* Pipeline progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${item.probability || 25}%` }]} />
      </View>
    </TouchableOpacity>
  ), [router]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlatList
        data={deals}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary[600]} />}
        ListEmptyComponent={!isLoading ? <EmptyState icon="handshake-outline" title="No Deals" description="Create deals from qualified leads" /> : null}
      />
    </SafeAreaView>
  );
}

function getStageVariant(stage?: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (stage?.toLowerCase()) {
    case 'won':
    case 'closed won': return 'success';
    case 'negotiation':
    case 'proposal': return 'warning';
    case 'lost':
    case 'closed lost': return 'error';
    case 'qualification':
    case 'discovery': return 'info';
    default: return 'default';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  list: { padding: spacing.lg, gap: spacing.md },
  dealCard: { backgroundColor: colors.background.default, borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.sm },
  dealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  dealTitle: { ...typography.body, fontWeight: '600', color: colors.text.primary, flex: 1, marginRight: spacing.sm },
  dealValue: { ...typography.body, fontWeight: '700', color: colors.success.main },
  dealCompany: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing.md },
  dealFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  dealProbability: { ...typography.caption, color: colors.text.tertiary },
  progressBar: { height: 4, backgroundColor: colors.gray[200], borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary[500], borderRadius: 2 },
});
