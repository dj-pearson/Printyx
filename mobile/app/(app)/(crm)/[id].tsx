/**
 * CRM Detail Screen
 *
 * Displays detail view for leads, customers, or deals.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Badge, Avatar, LoadingScreen } from '@/components/ui';
import { colors, spacing, typography, touchTargets } from '@/theme';

export default function CRMDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();

  const endpoint = type === 'deal' ? `/api/deals/${id}` : `/api/business-records/${id}`;

  const { data: record, isLoading } = useQuery({
    queryKey: [endpoint],
    enabled: !!id,
  });

  if (isLoading) return <LoadingScreen />;

  if (!record) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.centered}>
          <Text style={styles.notFound}>Record not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = record.companyName || record.name || record.title || 'Unknown';
  const email = record.email || record.contactEmail;
  const phone = record.phone || record.contactPhone;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Avatar name={name} size={56} />
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{name}</Text>
              <Badge
                label={record.status || record.stage || type || 'Active'}
                variant="info"
                size="md"
              />
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            {phone && (
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => Linking.openURL(`tel:${phone}`)}
                accessibilityLabel="Call"
              >
                <MaterialCommunityIcons name="phone" size={22} color={colors.primary[600]} />
                <Text style={styles.quickActionLabel}>Call</Text>
              </TouchableOpacity>
            )}
            {email && (
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => Linking.openURL(`mailto:${email}`)}
                accessibilityLabel="Email"
              >
                <MaterialCommunityIcons name="email" size={22} color={colors.primary[600]} />
                <Text style={styles.quickActionLabel}>Email</Text>
              </TouchableOpacity>
            )}
            {phone && (
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => Linking.openURL(`sms:${phone}`)}
                accessibilityLabel="Message"
              >
                <MaterialCommunityIcons name="message-text" size={22} color={colors.primary[600]} />
                <Text style={styles.quickActionLabel}>Text</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Details Card */}
        <Card>
          <Text style={styles.sectionTitle}>Details</Text>
          {email && <DetailRow label="Email" value={email} />}
          {phone && <DetailRow label="Phone" value={phone} />}
          {record.address && <DetailRow label="Address" value={record.address} />}
          {record.city && <DetailRow label="City" value={`${record.city}${record.state ? `, ${record.state}` : ''}`} />}
          {record.source && <DetailRow label="Source" value={record.source} />}
          {record.industry && <DetailRow label="Industry" value={record.industry} />}
          {(record.value || record.estimatedValue || record.amount) && (
            <DetailRow
              label="Value"
              value={`$${Number(record.value || record.estimatedValue || record.amount).toLocaleString()}`}
            />
          )}
          {record.assignedTo && <DetailRow label="Assigned To" value={record.assignedTo} />}
          {record.createdAt && (
            <DetailRow label="Created" value={new Date(record.createdAt).toLocaleDateString()} />
          )}
        </Card>

        {record.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{record.notes}</Text>
          </Card>
        )}
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
  headerCard: { padding: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  headerInfo: { flex: 1, gap: spacing.sm },
  name: { ...typography.h3, color: colors.text.primary },
  quickActions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  quickAction: { alignItems: 'center', gap: 4, width: touchTargets.comfortable, minHeight: touchTargets.comfortable },
  quickActionLabel: { ...typography.caption, color: colors.primary[600] },
  sectionTitle: { ...typography.h4, color: colors.text.primary, marginBottom: spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[50] },
  detailLabel: { ...typography.bodySmall, color: colors.text.secondary, flex: 1 },
  detailValue: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '500', flex: 2, textAlign: 'right' },
  notesCard: { marginBottom: spacing['3xl'] },
  notes: { ...typography.body, color: colors.text.secondary, lineHeight: 22 },
});
