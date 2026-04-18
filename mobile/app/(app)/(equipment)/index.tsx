/**
 * Equipment Screen
 *
 * Equipment inventory with glass search bar, barcode scanning action,
 * and status-aware list cards.
 */

import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Badge,
  EmptyState,
  GlassCard,
  SearchBar,
} from '@/components/ui';
import {
  borderRadius,
  colors,
  gradients,
  shadows,
  spacing,
  typography,
} from '@/theme';

export default function EquipmentScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data: equipment, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/equipment', `?search=${search}&limit=50`],
  });

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <GlassCard
        tone="light"
        padded={false}
        onPress={() =>
          router.push({
            pathname: '/(app)/(equipment)/[id]',
            params: { id: item.id },
          })
        }
        accessibilityLabel={`${item.model || 'Equipment'}, serial ${item.serialNumber || 'unknown'}`}
        style={styles.equipmentCard}
      >
        <View style={styles.equipmentRow}>
          <LinearGradient
            colors={gradients.brandSoft as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <MaterialCommunityIcons
              name={getEquipmentIcon(item.type || item.category)}
              size={26}
              color={colors.primary[600]}
            />
          </LinearGradient>
          <View style={styles.equipmentInfo}>
            <Text style={styles.equipmentName} numberOfLines={1}>
              {item.model || item.name || 'Unknown Equipment'}
            </Text>
            <Text style={styles.equipmentSerial} numberOfLines={1}>
              S/N · {item.serialNumber || '—'}
            </Text>
            {item.customerName ? (
              <Text style={styles.equipmentCustomer} numberOfLines={1}>
                {item.customerName}
              </Text>
            ) : null}
          </View>
          <Badge
            label={item.status || 'Active'}
            variant={getStatusVariant(item.status)}
            size="sm"
            withDot
          />
        </View>
      </GlassCard>
    ),
    [router],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Fleet</Text>
        <Text style={styles.subtitle}>
          Search, scan, and manage your installed equipment.
        </Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search by model, serial, customer"
            variant="glass"
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.scanButton,
            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
          ]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          accessibilityLabel="Scan barcode"
          accessibilityRole="button"
        >
          <LinearGradient
            colors={gradients.brand as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scanInner}
          >
            <MaterialCommunityIcons
              name="barcode-scan"
              size={22}
              color="#ffffff"
            />
          </LinearGradient>
        </Pressable>
      </View>

      <FlatList
        data={equipment}
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="printer-off-outline"
              title="No equipment yet"
              description="Installed equipment records will appear here as you add them."
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function getEquipmentIcon(type?: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (type?.toLowerCase()) {
    case 'printer':
    case 'copier':
      return 'printer-outline';
    case 'scanner':
      return 'scanner';
    case 'fax':
      return 'fax';
    default:
      return 'printer-outline';
  }
}

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'error' | 'default' {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'success';
    case 'maintenance':
    case 'service':
      return 'warning';
    case 'inactive':
    case 'decommissioned':
      return 'error';
    default:
      return 'default';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.canvas,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 34,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  searchBarWrapper: { flex: 1 },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    ...shadows.md,
  },
  scanInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 140,
  },
  separator: {
    height: spacing.sm,
  },
  equipmentCard: {
    marginBottom: 0,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentInfo: { flex: 1 },
  equipmentName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  equipmentSerial: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  equipmentCustomer: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 1,
  },
});
