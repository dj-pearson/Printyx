/**
 * Contacts Screen
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SearchBar, Avatar, EmptyState } from '@/components/ui';
import { colors, spacing, typography, touchTargets } from '@/theme';

export default function ContactsScreen() {
  const [search, setSearch] = useState('');

  const { data: rawContacts, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: [`/api/contacts?search=${search}&limit=50`],
  });
  // Handle both auto-unwrapped arrays and { data } / { records } response formats
  const contacts: any[] = Array.isArray(rawContacts) ? rawContacts : (rawContacts?.data || rawContacts?.records || []);

  const renderItem = useCallback(({ item }: { item: any }) => {
    // Handle both camelCase and snake_case field names from DB
    const firstName = item.firstName || item.first_name || '';
    const lastName = item.lastName || item.last_name || '';
    const title = item.title || item.job_title || '';
    const companyName = item.companyName || item.company_name || item.companies?.business_name || '';
    const phone = item.phone;
    const email = item.email;

    return (
      <View style={styles.contactRow}>
        <Avatar name={`${firstName} ${lastName}`} size={44} />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>
            {firstName} {lastName}
          </Text>
          {title ? <Text style={styles.contactTitle} numberOfLines={1}>{title}</Text> : null}
          {companyName ? <Text style={styles.contactCompany} numberOfLines={1}>{companyName}</Text> : null}
        </View>
        <View style={styles.actions}>
          {phone ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${phone}`)}
              style={styles.actionBtn}
              accessibilityLabel={`Call ${firstName}`}
            >
              <MaterialCommunityIcons name="phone" size={20} color={colors.primary[600]} />
            </TouchableOpacity>
          ) : null}
          {email ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${email}`)}
              style={styles.actionBtn}
              accessibilityLabel={`Email ${firstName}`}
            >
              <MaterialCommunityIcons name="email" size={20} color={colors.primary[600]} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.searchContainer}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search contacts..." />
      </View>
      <FlatList
        data={contacts}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary[600]} />}
        ListEmptyComponent={!isLoading ? <EmptyState icon="contacts-outline" title="No Contacts" description="Business contacts will appear here" /> : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  searchContainer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  list: { paddingBottom: 140 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md, minHeight: 64 },
  contactInfo: { flex: 1 },
  contactName: { ...typography.body, fontWeight: '500', color: colors.text.primary },
  contactTitle: { ...typography.caption, color: colors.text.secondary, marginTop: 1 },
  contactCompany: { ...typography.caption, color: colors.text.tertiary, marginTop: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { width: touchTargets.minimum, height: touchTargets.minimum, borderRadius: touchTargets.minimum / 2, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  separator: { height: 1, backgroundColor: colors.gray[100], marginLeft: spacing.lg + 44 + spacing.md },
});
