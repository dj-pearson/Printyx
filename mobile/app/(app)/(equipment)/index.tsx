/**
 * Equipment Screen
 *
 * Equipment inventory with search, barcode scanning, and status overview.
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SearchBar, Badge, EmptyState } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows, touchTargets } from '@/theme';

export default function EquipmentScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data: equipment, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/equipment', `?search=${search}&limit=50`],
  });

  const renderItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.equipmentCard}
      onPress={() => router.push({ pathname: '/(app)/(equipment)/[id]', params: { id: item.id } })}
      activeOpacity={0.7}
    >
      <View style={styles.iconBox}>
        <MaterialCommunityIcons
          name={getEquipmentIcon(item.type || item.category)}
          size={28}
          color={colors.primary[600]}
        />
      </View>
      <View style={styles.equipmentInfo}>
        <Text style={styles.equipmentName} numberOfLines={1}>
          {item.model || item.name || 'Unknown Equipment'}
        </Text>
        <Text style={styles.equipmentSerial} numberOfLines={1}>
          S/N: {item.serialNumber || '--'}
        </Text>
        {item.customerName && (
          <Text style={styles.equipmentCustomer} numberOfLines={1}>{item.customerName}</Text>
        )}
      </View>
      <Badge
        label={item.status || 'Active'}
        variant={getStatusVariant(item.status)}
        size="sm"
      />
    </TouchableOpacity>
  ), [router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Equipment</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBarWrapper}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search equipment..." />
        </View>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => {
            // Camera barcode scanning would be implemented here
          }}
          accessibilityLabel="Scan barcode"
        >
          <MaterialCommunityIcons name="barcode-scan" size={24} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={equipment}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary[600]} />}
        ListEmptyComponent={!isLoading ? <EmptyState icon="printer-off" title="No Equipment" description="Equipment records will appear here" /> : null}
      />
    </SafeAreaView>
  );
}

function getEquipmentIcon(type?: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (type?.toLowerCase()) {
    case 'printer':
    case 'copier': return 'printer';
    case 'scanner': return 'scanner';
    case 'fax': return 'fax';
    default: return 'printer';
  }
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status?.toLowerCase()) {
    case 'active': return 'success';
    case 'maintenance':
    case 'service': return 'warning';
    case 'inactive':
    case 'decommissioned': return 'error';
    default: return 'default';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { ...typography.h1, color: colors.text.primary },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md, gap: spacing.sm,
  },
  searchBarWrapper: { flex: 1 },
  scanButton: {
    width: touchTargets.comfortable, height: touchTargets.comfortable,
    borderRadius: borderRadius.lg, backgroundColor: colors.primary[50],
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: spacing.lg, gap: spacing.md },
  equipmentCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.background.default, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadows.sm,
  },
  iconBox: {
    width: 48, height: 48, borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center',
  },
  equipmentInfo: { flex: 1 },
  equipmentName: { ...typography.body, fontWeight: '600', color: colors.text.primary },
  equipmentSerial: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  equipmentCustomer: { ...typography.caption, color: colors.text.tertiary, marginTop: 1 },
});
