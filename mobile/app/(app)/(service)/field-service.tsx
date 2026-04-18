/**
 * Field Service Screen
 *
 * Mobile-optimized field service view for technicians in the field.
 * Includes time tracking, photo capture, and service completion.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Badge, EmptyState } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

export default function FieldServiceScreen() {
  const queryClient = useQueryClient();
  const [activeTimer, setActiveTimer] = useState<string | null>(null);

  const { data: assignments, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/mobile/dashboard'],
  });

  const startTimerMutation = useMutation({
    mutationFn: (ticketId: string) =>
      apiRequest('/api/mobile/time-tracking/start', { method: 'POST', body: { ticketId } }),
    onSuccess: (_, ticketId) => {
      setActiveTimer(ticketId);
      queryClient.invalidateQueries({ queryKey: ['/api/mobile/dashboard'] });
    },
    onError: () => Alert.alert('Error', 'Failed to start timer'),
  });

  const stopTimerMutation = useMutation({
    mutationFn: (ticketId: string) =>
      apiRequest('/api/mobile/time-tracking/stop', { method: 'POST', body: { ticketId } }),
    onSuccess: () => {
      setActiveTimer(null);
      queryClient.invalidateQueries({ queryKey: ['/api/mobile/dashboard'] });
    },
    onError: () => Alert.alert('Error', 'Failed to stop timer'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: string }) =>
      apiRequest(`/api/mobile/service-tickets/${ticketId}/status`, {
        method: 'POST',
        body: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mobile/dashboard'] });
    },
    onError: () => Alert.alert('Error', 'Failed to update status'),
  });

  const ticketsList = Array.isArray(assignments)
    ? assignments
    : assignments?.tickets || assignments?.assignments || [];

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary[600]} />}
      >
        <View style={styles.statusBar}>
          <MaterialCommunityIcons
            name={activeTimer ? 'timer' : 'timer-off'}
            size={20}
            color={activeTimer ? colors.success.main : colors.text.tertiary}
          />
          <Text style={[styles.statusText, activeTimer && styles.activeText]}>
            {activeTimer ? 'Timer Running' : 'No Active Timer'}
          </Text>
        </View>

        {Array.isArray(ticketsList) && ticketsList.length > 0 ? (
          ticketsList.map((ticket: any) => (
            <Card key={ticket.id} style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketId}>#{ticket.ticketNumber || ticket.id}</Text>
                <Badge
                  label={ticket.priority || 'Normal'}
                  variant={ticket.priority?.toLowerCase() === 'high' ? 'error' : 'default'}
                />
              </View>
              <Text style={styles.ticketTitle}>{ticket.title || ticket.description}</Text>
              {ticket.customerName && (
                <Text style={styles.customerName}>{ticket.customerName}</Text>
              )}
              {ticket.address && (
                <View style={styles.addressRow}>
                  <MaterialCommunityIcons name="map-marker" size={16} color={colors.text.tertiary} />
                  <Text style={styles.addressText}>{ticket.address}</Text>
                </View>
              )}

              <View style={styles.actionRow}>
                {activeTimer === String(ticket.id) ? (
                  <Button
                    title="Stop Timer"
                    onPress={() => stopTimerMutation.mutate(String(ticket.id))}
                    variant="destructive"
                    size="sm"
                    loading={stopTimerMutation.isPending}
                  />
                ) : (
                  <Button
                    title="Start Timer"
                    onPress={() => startTimerMutation.mutate(String(ticket.id))}
                    variant="primary"
                    size="sm"
                    loading={startTimerMutation.isPending}
                    disabled={!!activeTimer}
                  />
                )}
                <Button
                  title="Complete"
                  onPress={() => updateStatusMutation.mutate({ ticketId: String(ticket.id), status: 'completed' })}
                  variant="outline"
                  size="sm"
                  loading={updateStatusMutation.isPending}
                />
              </View>
            </Card>
          ))
        ) : !isLoading ? (
          <EmptyState
            icon="clipboard-check-outline"
            title="No Assignments"
            description="Your field assignments will appear here"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background.default, borderRadius: borderRadius.lg,
    padding: spacing.md, ...shadows.sm,
  },
  statusText: { ...typography.bodySmall, color: colors.text.tertiary },
  activeText: { color: colors.success.main, fontWeight: '600' },
  ticketCard: { padding: spacing.lg },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  ticketId: { ...typography.caption, color: colors.text.tertiary, fontWeight: '600' },
  ticketTitle: { ...typography.body, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.xs },
  customerName: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing.sm },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  addressText: { ...typography.bodySmall, color: colors.text.secondary, flex: 1 },
  actionRow: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray[100] },
});
