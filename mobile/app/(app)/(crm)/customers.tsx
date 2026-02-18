/**
 * Customers Screen
 *
 * List of active customer accounts with search.
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
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SearchBar, Avatar, Badge, EmptyState } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export default function CustomersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data: rawData, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: [`/api/companies?recordType=Customer&search=${search}&limit=50`],
  });
  // Handle both auto-unwrapped arrays and { records } / { data } response formats
  const customers: any[] = Array.isArray(rawData) ? rawData : (rawData?.records || rawData?.data || []);

  const renderItem = useCallback(({ item }: { item: any }) => {
    // Handle both camelCase and snake_case field names from DB
    const name = item.companyName || item.business_name || item.name || 'Unnamed';
    const detail = item.email || item.phone || 'No contact info';
    const status = item.status || item.activity || 'Active';

    return (
      <TouchableOpacity
        style={styles.customerRow}
        onPress={() => router.push({ pathname: '/(app)/(crm)/[id]', params: { id: item.id, type: 'customer' } })}
        activeOpacity={0.7}
      >
        <Avatar name={name} size={44} />
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.customerDetail} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <Badge
          label={status}
          variant={status === 'active' ? 'success' : 'default'}
          size="sm"
        />
      </TouchableOpacity>
    );
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customers..."
        />
      </View>

      <FlatList
        data={customers}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary[600]} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="account-group-outline"
              title="No Customers"
              description="Customer accounts will appear here"
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  list: { paddingBottom: spacing['3xl'] },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 64,
  },
  customerInfo: { flex: 1 },
  customerName: { ...typography.body, fontWeight: '500', color: colors.text.primary },
  customerDetail: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.gray[100], marginLeft: spacing.lg + 44 + spacing.md },
});
