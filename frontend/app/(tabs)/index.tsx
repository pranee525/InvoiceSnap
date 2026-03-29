import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getSummary, getExpiryAlerts } from '../../src/services/api';
import { useRouter } from 'expo-router';

interface Summary {
  invoice_count: number;
  total_amount: number;
  total_items: number;
  shop_count: number;
  expiring_soon: number;
  expired: number;
}

interface Alert {
  product_name: string;
  expiry_date: string;
  days_until_expiry: number;
  shop_name: string;
  quantity: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<{ expired: Alert[]; this_month: Alert[] }>({ expired: [], this_month: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [summaryData, alertsData] = await Promise.all([
        getSummary(),
        getExpiryAlerts(),
      ]);
      setSummary(summaryData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const urgentAlerts = [...(alerts.expired || []), ...(alerts.this_month || [])].slice(0, 5);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#1e3a5f' }]}>
            <Ionicons name="receipt" size={28} color="#3b82f6" />
            <Text style={styles.statValue}>{summary?.invoice_count || 0}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#1e3a3a' }]}>
            <Ionicons name="storefront" size={28} color="#22c55e" />
            <Text style={styles.statValue}>{summary?.shop_count || 0}</Text>
            <Text style={styles.statLabel}>Shops</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#3a2f1e' }]}>
            <Ionicons name="medical" size={28} color="#f59e0b" />
            <Text style={styles.statValue}>{summary?.total_items || 0}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#3a1e2f' }]}>
            <Ionicons name="cash" size={28} color="#ec4899" />
            <Text style={styles.statValue}>₹{(summary?.total_amount || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Alert Banner */}
        {(summary?.expired || 0) > 0 && (
          <TouchableOpacity 
            style={styles.alertBanner}
            onPress={() => router.push('/(tabs)/alerts')}
          >
            <Ionicons name="warning" size={24} color="#ef4444" />
            <View style={styles.alertBannerText}>
              <Text style={styles.alertBannerTitle}>{summary?.expired} Items Expired</Text>
              <Text style={styles.alertBannerSubtitle}>Tap to view details</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ef4444" />
          </TouchableOpacity>
        )}

        {(summary?.expiring_soon || 0) > 0 && (
          <TouchableOpacity 
            style={[styles.alertBanner, { backgroundColor: '#422006' }]}
            onPress={() => router.push('/(tabs)/alerts')}
          >
            <Ionicons name="alarm" size={24} color="#f59e0b" />
            <View style={styles.alertBannerText}>
              <Text style={[styles.alertBannerTitle, { color: '#f59e0b' }]}>
                {summary?.expiring_soon} Items Expiring Soon
              </Text>
              <Text style={styles.alertBannerSubtitle}>Within 2 months</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/scan')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#1e3a5f' }]}>
              <Ionicons name="camera" size={28} color="#3b82f6" />
            </View>
            <Text style={styles.actionText}>Scan Invoice</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/reports')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#2e1e3a' }]}>
              <Ionicons name="bar-chart" size={28} color="#8b5cf6" />
            </View>
            <Text style={styles.actionText}>View Reports</Text>
          </TouchableOpacity>
        </View>

        {/* Urgent Alerts */}
        {urgentAlerts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Urgent Alerts</Text>
            {urgentAlerts.map((alert, index) => (
              <View key={index} style={styles.alertItem}>
                <View style={[
                  styles.alertDot,
                  { backgroundColor: alert.days_until_expiry < 0 ? '#ef4444' : '#f59e0b' }
                ]} />
                <View style={styles.alertInfo}>
                  <Text style={styles.alertProductName}>{alert.product_name}</Text>
                  <Text style={styles.alertDetails}>
                    {alert.shop_name} • Qty: {alert.quantity || 'N/A'}
                  </Text>
                </View>
                <View style={styles.alertExpiry}>
                  <Text style={[
                    styles.alertExpiryText,
                    { color: alert.days_until_expiry < 0 ? '#ef4444' : '#f59e0b' }
                  ]}>
                    {alert.days_until_expiry < 0 
                      ? `Expired ${Math.abs(alert.days_until_expiry)}d ago`
                      : `${alert.days_until_expiry}d left`}
                  </Text>
                  <Text style={styles.alertExpiryDate}>{alert.expiry_date}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#94a3b8',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#450a0a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  alertBannerText: {
    flex: 1,
    marginLeft: 12,
  },
  alertBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  alertBannerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 16,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  alertInfo: {
    flex: 1,
    marginLeft: 12,
  },
  alertProductName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  alertDetails: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  alertExpiry: {
    alignItems: 'flex-end',
  },
  alertExpiryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  alertExpiryDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});
