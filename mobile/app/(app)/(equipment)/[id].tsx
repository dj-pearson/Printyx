/**
 * Equipment Detail Screen
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Badge, LoadingScreen } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: equipment, isLoading } = useQuery({
    queryKey: [`/api/equipment/${id}`],
    enabled: !!id,
  });

  const { data: serviceHistory } = useQuery<any[]>({
    queryKey: [`/api/equipment/${id}/service-history`],
    enabled: !!id,
  });

  if (isLoading) return <LoadingScreen />;

  if (!equipment) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.centered}>
          <Text style={styles.notFound}>Equipment not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Equipment Header */}
        <Card>
          <View style={styles.headerRow}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="printer" size={32} color={colors.primary[600]} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.equipmentName}>{equipment.model || equipment.name}</Text>
              <Text style={styles.serialNumber}>S/N: {equipment.serialNumber || '--'}</Text>
              <Badge label={equipment.status || 'Active'} variant="success" />
            </View>
          </View>
        </Card>

        {/* Details */}
        <Card>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Manufacturer" value={equipment.manufacturer || '--'} />
          <DetailRow label="Model" value={equipment.model || '--'} />
          <DetailRow label="Serial Number" value={equipment.serialNumber || '--'} />
          <DetailRow label="Customer" value={equipment.customerName || '--'} />
          <DetailRow label="Location" value={equipment.location || '--'} />
          <DetailRow label="Install Date" value={equipment.installDate ? new Date(equipment.installDate).toLocaleDateString() : '--'} />
          <DetailRow label="Contract" value={equipment.contractNumber || '--'} />
          <DetailRow label="IP Address" value={equipment.ipAddress || '--'} />
        </Card>

        {/* Meter Readings */}
        {equipment.lastMeterReading && (
          <Card>
            <Text style={styles.sectionTitle}>Meter Readings</Text>
            <View style={styles.meterGrid}>
              <View style={styles.meterItem}>
                <Text style={styles.meterValue}>
                  {Number(equipment.lastMeterReading.bw || 0).toLocaleString()}
                </Text>
                <Text style={styles.meterLabel}>B&W</Text>
              </View>
              <View style={styles.meterItem}>
                <Text style={styles.meterValue}>
                  {Number(equipment.lastMeterReading.color || 0).toLocaleString()}
                </Text>
                <Text style={styles.meterLabel}>Color</Text>
              </View>
              <View style={styles.meterItem}>
                <Text style={styles.meterValue}>
                  {Number(equipment.lastMeterReading.total || 0).toLocaleString()}
                </Text>
                <Text style={styles.meterLabel}>Total</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Service History */}
        <Card>
          <Text style={styles.sectionTitle}>Service History</Text>
          {Array.isArray(serviceHistory) && serviceHistory.length > 0 ? (
            serviceHistory.slice(0, 10).map((entry: any, i: number) => (
              <View key={entry.id || i} style={[styles.historyItem, i > 0 && styles.historyBorder]}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDate}>
                    {entry.date ? new Date(entry.date).toLocaleDateString() : '--'}
                  </Text>
                  <Text style={styles.historyType}>{entry.type || 'Service'}</Text>
                </View>
                <Text style={styles.historyDesc} numberOfLines={2}>{entry.description || '--'}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No service history</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { padding: spacing.lg, gap: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { ...typography.body, color: colors.text.secondary },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  iconBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, gap: spacing.xs },
  equipmentName: { ...typography.h3, color: colors.text.primary },
  serialNumber: { ...typography.bodySmall, color: colors.text.secondary },
  sectionTitle: { ...typography.h4, color: colors.text.primary, marginBottom: spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[50] },
  detailLabel: { ...typography.bodySmall, color: colors.text.secondary, flex: 1 },
  detailValue: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '500', flex: 2, textAlign: 'right' },
  meterGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  meterItem: { alignItems: 'center' },
  meterValue: { ...typography.h3, color: colors.text.primary },
  meterLabel: { ...typography.caption, color: colors.text.secondary },
  historyItem: { paddingVertical: spacing.sm },
  historyBorder: { borderTopWidth: 1, borderTopColor: colors.gray[100] },
  historyLeft: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyDate: { ...typography.caption, color: colors.text.tertiary },
  historyType: { ...typography.caption, color: colors.primary[600], fontWeight: '500' },
  historyDesc: { ...typography.bodySmall, color: colors.text.secondary },
  emptyText: { ...typography.body, color: colors.text.tertiary, textAlign: 'center', paddingVertical: spacing.lg },
});
