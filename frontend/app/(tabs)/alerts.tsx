import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getExpiryAlerts } from '../../src/services/api';

interface Alert {
  item_id: string;
  invoice_id: string;
  product_name: string;
  batch_no: string;
  expiry_date: string;
  expiry_datetime: string;
  shop_name: string;
  quantity: number;
  days_until_expiry: number;
}

interface Alerts {
  expired: Alert[];
  this_month: Alert[];
  next_month: Alert[];
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<Alerts>({ expired: [], this_month: [], next_month: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'expired' | 'this_month' | 'next_month'>('expired');

  const loadAlerts = useCallback(async () => {
    try {
      const data = await getExpiryAlerts();
      setAlerts(data);
      
      // Auto-select first tab with items
      if (data.expired?.length > 0) {
        setActiveTab('expired');
      } else if (data.this_month?.length > 0) {
        setActiveTab('this_month');
      } else if (data.next_month?.length > 0) {
        setActiveTab('next_month');
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAlerts();
  }, [loadAlerts]);

  const totalAlerts = (alerts.expired?.length || 0) + (alerts.this_month?.length || 0) + (alerts.next_month?.length || 0);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  const getActiveAlerts = () => {
    switch (activeTab) {
      case 'expired':
        return alerts.expired || [];
      case 'this_month':
        return alerts.this_month || [];
      case 'next_month':
        return alerts.next_month || [];
      default:
        return [];
    }
  };

  const activeAlerts = getActiveAlerts();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expiry Alerts</Text>
        {totalAlerts > 0 && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{totalAlerts}</Text>
          </View>
        )}
      </View>

      {totalAlerts === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          <Text style={styles.emptyTitle}>All Clear!</Text>
          <Text style={styles.emptySubtitle}>No items expiring soon</Text>
        </View>
      ) : (
        <>
          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'expired' && styles.tabActiveRed,
              ]}
              onPress={() => setActiveTab('expired')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'expired' && styles.tabTextActiveRed,
              ]}>
                Expired ({alerts.expired?.length || 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'this_month' && styles.tabActiveOrange,
              ]}
              onPress={() => setActiveTab('this_month')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'this_month' && styles.tabTextActiveOrange,
              ]}>
                This Month ({alerts.this_month?.length || 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'next_month' && styles.tabActiveYellow,
              ]}
              onPress={() => setActiveTab('next_month')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'next_month' && styles.tabTextActiveYellow,
              ]}>
                Next Month ({alerts.next_month?.length || 0})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
            }
          >
            {activeAlerts.length === 0 ? (
              <View style={styles.noItemsContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text style={styles.noItemsText}>No items in this category</Text>
              </View>
            ) : (
              activeAlerts.map((alert, index) => (
                <View key={`${alert.item_id}-${index}`} style={styles.alertCard}>
                  <View style={[
                    styles.alertIndicator,
                    {
                      backgroundColor: activeTab === 'expired' 
                        ? '#ef4444' 
                        : activeTab === 'this_month' 
                          ? '#f97316' 
                          : '#eab308'
                    }
                  ]} />
                  <View style={styles.alertContent}>
                    <View style={styles.alertHeader}>
                      <Text style={styles.productName}>{alert.product_name}</Text>
                      <View style={[
                        styles.expiryBadge,
                        {
                          backgroundColor: activeTab === 'expired' 
                            ? '#450a0a' 
                            : activeTab === 'this_month' 
                              ? '#431407' 
                              : '#422006'
                        }
                      ]}>
                        <Text style={[
                          styles.expiryBadgeText,
                          {
                            color: activeTab === 'expired' 
                              ? '#ef4444' 
                              : activeTab === 'this_month' 
                                ? '#f97316' 
                                : '#eab308'
                          }
                        ]}>
                          {alert.days_until_expiry < 0 
                            ? `${Math.abs(alert.days_until_expiry)}d ago`
                            : `${alert.days_until_expiry}d left`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.alertMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="storefront-outline" size={14} color="#64748b" />
                        <Text style={styles.metaText}>{alert.shop_name}</Text>
                      </View>
                      {alert.batch_no && (
                        <View style={styles.metaItem}>
                          <Ionicons name="barcode-outline" size={14} color="#64748b" />
                          <Text style={styles.metaText}>{alert.batch_no}</Text>
                        </View>
                      )}
                      {alert.quantity && (
                        <View style={styles.metaItem}>
                          <Ionicons name="cube-outline" size={14} color="#64748b" />
                          <Text style={styles.metaText}>Qty: {alert.quantity}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.expiryDateRow}>
                      <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
                      <Text style={styles.expiryDateText}>Expires: {alert.expiry_date}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        </>
      )}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  totalBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#1e293b',
  },
  tabActiveRed: {
    backgroundColor: '#450a0a',
  },
  tabActiveOrange: {
    backgroundColor: '#431407',
  },
  tabActiveYellow: {
    backgroundColor: '#422006',
  },
  tabText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  tabTextActiveRed: {
    color: '#ef4444',
  },
  tabTextActiveOrange: {
    color: '#f97316',
  },
  tabTextActiveYellow: {
    color: '#eab308',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noItemsContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noItemsText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  alertIndicator: {
    width: 4,
  },
  alertContent: {
    flex: 1,
    padding: 14,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  expiryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  expiryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  expiryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiryDateText: {
    fontSize: 13,
    color: '#94a3b8',
    marginLeft: 6,
  },
});
