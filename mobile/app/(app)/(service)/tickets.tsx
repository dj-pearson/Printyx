/**
 * Service Tickets Screen
 *
 * List of service tickets with status filtering and search.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SearchBar, Badge, EmptyState } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Pending', 'Completed'] as const;

export default function TicketsScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const { data: tickets, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/service-tickets', `?search=${search}&status=${statusFilter === 'All' ? '' : statusFilter}&limit=50`],
  });

  const renderItem = useCallback(({ item }: { item: any }) => (
    <View style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketId}>#{item.ticketNumber || item.id}</Text>
        <Badge
          label={item.priority || 'Normal'}
          variant={getPriorityVariant(item.priority)}
          size="sm"
        />
      </View>
      <Text style={styles.ticketTitle} numberOfLines={2}>{item.title || item.description}</Text>
      <Text style={styles.ticketCustomer} numberOfLines={1}>
        {item.customerName || item.companyName || 'Unassigned'}
      </Text>
      <View style={styles.ticketFooter}>
        <Badge label={item.status || 'Open'} variant={getStatusVariant(item.status)} />
        <View style={styles.techRow}>
          <MaterialCommunityIcons name="account-wrench" size={14} color={colors.text.tertiary} />
          <Text style={styles.techName}>{item.technicianName || 'Unassigned'}</Text>
        </View>
      </View>
    </View>
  ), []);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.searchContainer}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search tickets..." />
      </View>

      {/* Status Filter Chips */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === item && styles.filterChipActive]}
            onPress={() => setStatusFilter(item)}
          >
            <Text style={[styles.filterChipText, statusFilter === item && styles.filterChipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterRow}
        showsHorizontalScrollIndicator={false}
      />

      <FlatList
        data={tickets}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary[600]} />}
        ListEmptyComponent={!isLoading ? <EmptyState icon="ticket-outline" title="No Tickets" description="Service tickets will appear here" /> : null}
      />
    </SafeAreaView>
  );
}

function getPriorityVariant(priority?: string): 'error' | 'warning' | 'info' | 'default' {
  switch (priority?.toLowerCase()) {
    case 'critical':
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'default';
  }
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'info' | 'default' {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'resolved': return 'success';
    case 'in progress': return 'warning';
    case 'open': return 'info';
    default: return 'default';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  searchContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.background.default },
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm, backgroundColor: colors.background.default },
  filterChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.gray[100] },
  filterChipActive: { backgroundColor: colors.primary[600] },
  filterChipText: { ...typography.bodySmall, color: colors.text.secondary, fontWeight: '500' },
  filterChipTextActive: { color: '#ffffff' },
  list: { padding: spacing.lg, gap: spacing.md },
  ticketCard: { backgroundColor: colors.background.default, borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.sm },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  ticketId: { ...typography.caption, color: colors.text.tertiary, fontWeight: '600' },
  ticketTitle: { ...typography.body, fontWeight: '500', color: colors.text.primary, marginBottom: spacing.xs },
  ticketCustomer: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing.md },
  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  techRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  techName: { ...typography.caption, color: colors.text.tertiary },
});
