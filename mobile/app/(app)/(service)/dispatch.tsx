/**
 * Service Dispatch Screen
 *
 * Dispatching and routing view for technicians and service calls.
 */

import React from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Badge, EmptyState } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

export default function DispatchScreen() {
  const { data: dispatches, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/service-dispatch', '?limit=20'],
  });

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary[600]} />}
      >
        {Array.isArray(dispatches) && dispatches.length > 0 ? (
          dispatches.map((dispatch: any) => (
            <View key={dispatch.id} style={styles.dispatchCard}>
              <View style={styles.dispatchHeader}>
                <View style={styles.techInfo}>
                  <MaterialCommunityIcons name="account-wrench" size={20} color={colors.primary[600]} />
                  <Text style={styles.techName}>{dispatch.technicianName || 'Unassigned'}</Text>
                </View>
                <Badge label={dispatch.status || 'Pending'} variant="info" />
              </View>
              <Text style={styles.dispatchTitle}>{dispatch.title || dispatch.description}</Text>
              {dispatch.customerName && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="domain" size={16} color={colors.text.tertiary} />
                  <Text style={styles.infoText}>{dispatch.customerName}</Text>
                </View>
              )}
              {dispatch.address && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="map-marker" size={16} color={colors.text.tertiary} />
                  <Text style={styles.infoText}>{dispatch.address}</Text>
                </View>
              )}
              {dispatch.scheduledAt && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={colors.text.tertiary} />
                  <Text style={styles.infoText}>
                    {new Date(dispatch.scheduledAt).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : !isLoading ? (
          <EmptyState
            icon="map-marker-path"
            title="No Dispatches"
            description="Service dispatches will appear here"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { padding: spacing.lg, gap: spacing.md },
  dispatchCard: { backgroundColor: colors.background.default, borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.sm },
  dispatchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  techInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  techName: { ...typography.bodySmall, fontWeight: '600', color: colors.text.primary },
  dispatchTitle: { ...typography.body, color: colors.text.primary, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  infoText: { ...typography.bodySmall, color: colors.text.secondary, flex: 1 },
});
