/**
 * Leads Screen
 *
 * List of leads with search, filtering, and pull-to-refresh.
 * Uses the unified business_records table with status filtering.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SearchBar, Badge, Card, EmptyState } from '@/components/ui';
import { colors, spacing, typography, touchTargets } from '@/theme';

export default function LeadsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const {
    data: rawData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<any>({
    queryKey: ['/api/companies', `?recordType=Lead&search=${search}&limit=50`],
  });
  // Handle both auto-unwrapped arrays and { records } / { data } response formats
  const leads: any[] = Array.isArray(rawData) ? rawData : (rawData?.records || rawData?.data || []);

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <TouchableOpacity
        style={styles.leadCard}
        onPress={() =>
          router.push({ pathname: '/(app)/(crm)/[id]', params: { id: item.id, type: 'lead' } })
        }
        activeOpacity={0.7}
        accessibilityLabel={`Lead: ${item.companyName || item.name}`}
      >
        <View style={styles.leadHeader}>
          <Text style={styles.leadName} numberOfLines={1}>
            {item.companyName || item.name || 'Unnamed Lead'}
          </Text>
          <Badge label={item.status || 'New'} variant={getStatusVariant(item.status)} />
        </View>
        {item.contactName && (
          <Text style={styles.leadContact} numberOfLines={1}>
            {item.contactName}
          </Text>
        )}
        {item.email && (
          <Text style={styles.leadEmail} numberOfLines={1}>
            {item.email}
          </Text>
        )}
        <View style={styles.leadFooter}>
          <Text style={styles.leadSource}>{item.source || 'Direct'}</Text>
          {item.estimatedValue && (
            <Text style={styles.leadValue}>${Number(item.estimatedValue).toLocaleString()}</Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [router],
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.searchContainer}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search leads..." />
      </View>

      <FlatList
        data={leads}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary[600]}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="account-plus-outline"
              title="No Leads Yet"
              description="Leads will appear here as they come in"
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function getStatusVariant(status?: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status?.toLowerCase()) {
    case 'qualified':
      return 'success';
    case 'contacted':
      return 'info';
    case 'proposal':
      return 'warning';
    case 'lost':
      return 'error';
    default:
      return 'default';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.default,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  leadCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  leadName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  leadContact: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  leadEmail: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  leadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  leadSource: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  leadValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.success.main,
  },
});
