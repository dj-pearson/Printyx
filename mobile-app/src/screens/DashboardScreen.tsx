import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';

type DashboardNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Dashboard Screen
 * Home screen showing technician stats and today's tickets
 */
export default function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { user } = useAuth();

  // Fetch stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['mobile-stats'],
    queryFn: () => apiClient.getStats(),
  });

  // Fetch today's tickets
  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['mobile-tickets'],
    queryFn: () => apiClient.getTickets(),
  });

  const tickets = ticketsData?.tickets || [];
  const todayTickets = tickets.filter((t: any) => {
    const today = new Date().toDateString();
    const ticketDate = new Date(t.createdAt).toDateString();
    return today === ticketDate;
  });

  const isRefreshing = statsLoading || ticketsLoading;

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchTickets()]);
  };

  const handleScanQR = () => {
    navigation.navigate('ScanQR');
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name}>{user?.name || 'Technician'}</Text>
        </View>
        <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
          <Ionicons name="qr-code-outline" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          icon="checkmark-circle"
          label="Completed"
          value={stats?.completed || 0}
          color="#10b981"
        />
        <StatCard
          icon="time"
          label="In Progress"
          value={stats?.inProgress || 0}
          color="#f59e0b"
        />
        <StatCard
          icon="list"
          label="Open"
          value={stats?.open || 0}
          color="#6366f1"
        />
      </View>

      {/* Today's Tickets */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Tickets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MainTabs')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {todayTickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No tickets for today</Text>
            <Text style={styles.emptyStateSubtext}>You're all caught up!</Text>
          </View>
        ) : (
          todayTickets.slice(0, 5).map((ticket: any) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={32} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * Ticket Card Component
 */
function TicketCard({ ticket, onPress }: { ticket: any; onPress: () => void }) {
  const statusColors: Record<string, string> = {
    new: '#6366f1',
    in_progress: '#f59e0b',
    completed: '#10b981',
  };

  const priorityColors: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f59e0b',
    medium: '#3b82f6',
    low: '#6b7280',
  };

  return (
    <TouchableOpacity style={styles.ticketCard} onPress={onPress}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketId}>#{ticket.ticketNumber || ticket.id.slice(0, 8)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[ticket.enhancedTicketStatus] || '#6b7280' }]}>
          <Text style={styles.statusText}>{ticket.enhancedTicketStatus}</Text>
        </View>
      </View>

      <Text style={styles.ticketTitle} numberOfLines={2}>
        {ticket.issue || 'Service Request'}
      </Text>

      {ticket.customer && (
        <View style={styles.ticketDetail}>
          <Ionicons name="business-outline" size={16} color="#6b7280" />
          <Text style={styles.ticketDetailText}>{ticket.customer.name}</Text>
        </View>
      )}

      {ticket.priority && (
        <View style={styles.ticketDetail}>
          <Ionicons
            name="flag"
            size={16}
            color={priorityColors[ticket.priority] || '#6b7280'}
          />
          <Text style={[styles.ticketDetailText, { color: priorityColors[ticket.priority] }]}>
            {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
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
  greeting: {
    fontSize: 16,
    color: '#6b7280',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  seeAll: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 48,
    alignItems: 'center',
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
});
