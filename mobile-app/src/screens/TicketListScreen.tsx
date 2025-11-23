import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type TicketListNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Ticket List Screen
 * Shows all assigned tickets with filtering
 */
export default function TicketListScreen() {
  const navigation = useNavigation<TicketListNavigationProp>();
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mobile-tickets', filter],
    queryFn: () => apiClient.getTickets(filter),
  });

  const tickets = data?.tickets || [];

  const renderTicket = ({ item: ticket }: { item: any }) => (
    <TouchableOpacity
      style={styles.ticketCard}
      onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}
    >
      {/* Header */}
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketId}>#{ticket.ticketNumber || ticket.id.slice(0, 8)}</Text>
        <StatusBadge status={ticket.enhancedTicketStatus} />
      </View>

      {/* Title */}
      <Text style={styles.ticketTitle} numberOfLines={2}>
        {ticket.issue || 'Service Request'}
      </Text>

      {/* Customer */}
      {ticket.customer && (
        <View style={styles.ticketDetail}>
          <Ionicons name="business-outline" size={16} color="#6b7280" />
          <Text style={styles.ticketDetailText}>{ticket.customer.name}</Text>
        </View>
      )}

      {/* Equipment */}
      {ticket.equipment && (
        <View style={styles.ticketDetail}>
          <Ionicons name="hardware-chip-outline" size={16} color="#6b7280" />
          <Text style={styles.ticketDetailText}>
            {ticket.equipment.manufacturer} {ticket.equipment.model}
          </Text>
        </View>
      )}

      {/* Priority */}
      {ticket.priority && (
        <View style={styles.ticketDetail}>
          <PriorityFlag priority={ticket.priority} />
          <Text style={[styles.ticketDetailText, { color: getPriorityColor(ticket.priority) }]}>
            {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.ticketFooter}>
        <Text style={styles.ticketDate}>
          {new Date(ticket.createdAt).toLocaleDateString()}
        </Text>
        {ticket.scheduledDate && (
          <View style={styles.scheduledBadge}>
            <Ionicons name="calendar-outline" size={12} color="#2563eb" />
            <Text style={styles.scheduledText}>
              {new Date(ticket.scheduledDate).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Tickets</Text>
        <TouchableOpacity style={styles.scanButton} onPress={() => navigation.navigate('ScanQR')}>
          <Ionicons name="qr-code-outline" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab
          label="All"
          isActive={filter === undefined}
          onPress={() => setFilter(undefined)}
        />
        <FilterTab
          label="Open"
          isActive={filter === 'new'}
          onPress={() => setFilter('new')}
        />
        <FilterTab
          label="In Progress"
          isActive={filter === 'in_progress'}
          onPress={() => setFilter('in_progress')}
        />
        <FilterTab
          label="Completed"
          isActive={filter === 'completed'}
          onPress={() => setFilter('completed')}
        />
      </View>

      {/* Ticket List */}
      <FlatList
        data={tickets}
        renderItem={renderTicket}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No tickets found</Text>
            <Text style={styles.emptyStateSubtext}>
              {filter ? 'Try changing the filter' : 'You have no assigned tickets'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

/**
 * Filter Tab Component
 */
function FilterTab({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, isActive && styles.filterTabActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
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
 * Priority Flag Component
 */
function PriorityFlag({ priority }: { priority: string }) {
  return (
    <Ionicons name="flag" size={16} color={getPriorityColor(priority)} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterTabActive: {
    backgroundColor: '#2563eb',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 8,
  },
  ticketDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  ticketDetailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  ticketDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
  },
  scheduledText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#2563eb',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
});
