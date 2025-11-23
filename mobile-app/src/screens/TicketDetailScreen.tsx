import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type TicketDetailRouteProp = RouteProp<RootStackParamList, 'TicketDetail'>;

/**
 * Ticket Detail Screen
 * Shows full ticket details with action buttons
 */
export default function TicketDetailScreen() {
  const route = useRoute<TicketDetailRouteProp>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { ticketId } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => apiClient.getTicket(ticketId),
  });

  const startTicketMutation = useMutation({
    mutationFn: () => apiClient.startTicket(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      Alert.alert('Success', 'Ticket started successfully');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to start ticket');
    },
  });

  const ticket = data?.ticket;
  const photos = data?.photos || [];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Ticket not found</Text>
      </View>
    );
  }

  const canStart = ticket.enhancedTicketStatus === 'new';
  const canComplete = ticket.enhancedTicketStatus === 'in_progress';

  return (
    <ScrollView style={styles.container}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.ticketId}>#{ticket.ticketNumber || ticket.id.slice(0, 8)}</Text>
          <StatusBadge status={ticket.enhancedTicketStatus} />
        </View>

        <Text style={styles.issueTitle}>{ticket.issue || 'Service Request'}</Text>

        {ticket.priority && (
          <View style={styles.priorityRow}>
            <Ionicons name="flag" size={16} color={getPriorityColor(ticket.priority)} />
            <Text style={[styles.priorityText, { color: getPriorityColor(ticket.priority) }]}>
              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
            </Text>
          </View>
        )}
      </View>

      {/* Customer Info */}
      {ticket.customer && (
        <InfoSection
          title="Customer"
          icon="business"
          items={[
            { label: 'Name', value: ticket.customer.name },
            { label: 'Email', value: ticket.customer.email },
            { label: 'Phone', value: ticket.customer.phone },
          ].filter((item) => item.value)}
        />
      )}

      {/* Equipment Info */}
      {ticket.equipment && (
        <InfoSection
          title="Equipment"
          icon="hardware-chip"
          items={[
            {
              label: 'Model',
              value: `${ticket.equipment.manufacturer} ${ticket.equipment.model}`,
            },
            { label: 'Serial Number', value: ticket.equipment.serialNumber },
            { label: 'Location', value: ticket.equipment.location },
          ].filter((item) => item.value)}
        />
      )}

      {/* Issue Details */}
      <InfoSection
        title="Issue Details"
        icon="information-circle"
        items={[
          { label: 'Description', value: ticket.issueDescription },
          { label: 'Category', value: ticket.category },
          { label: 'Created', value: new Date(ticket.createdAt).toLocaleString() },
          ticket.scheduledDate && {
            label: 'Scheduled',
            value: new Date(ticket.scheduledDate).toLocaleString(),
          },
        ].filter((item) => item && item.value)}
      />

      {/* Notes */}
      {ticket.notes && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>{ticket.notes}</Text>
          </View>
        </View>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images" size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
          </View>
          <Text style={styles.photosPlaceholder}>Photo gallery coming soon</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {canStart && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => startTicketMutation.mutate()}
            disabled={startTicketMutation.isPending}
          >
            <Ionicons name="play-circle" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>
              {startTicketMutation.isPending ? 'Starting...' : 'Start Work'}
            </Text>
          </TouchableOpacity>
        )}

        {canComplete && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => Alert.alert('Coming Soon', 'Completion flow will be added')}
          >
            <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Complete</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => Alert.alert('Coming Soon', 'Photo upload will be added')}
        >
          <Ionicons name="camera" size={20} color="#2563eb" />
          <Text style={styles.secondaryButtonText}>Add Photos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => Alert.alert('Coming Soon', 'Notes feature will be added')}
        >
          <Ionicons name="create" size={20} color="#2563eb" />
          <Text style={styles.secondaryButtonText}>Add Note</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/**
 * Info Section Component
 */
function InfoSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: { label: string; value: string }[];
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color="#2563eb" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.infoContainer}>
        {items.map((item, index) => (
          <View key={index} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: '#6366f1',
    in_progress: '#f59e0b',
    completed: '#10b981',
  };

  return (
    <View style={[styles.statusBadge, { backgroundColor: colors[status] || '#6b7280' }]}>
      <Text style={styles.statusText}>{status.replace('_', ' ')}</Text>
    </View>
  );
}

/**
 * Get priority color
 */
function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f59e0b',
    medium: '#3b82f6',
    low: '#6b7280',
  };
  return colors[priority] || '#6b7280';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  issueTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  infoContainer: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  notesContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  photosPlaceholder: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
