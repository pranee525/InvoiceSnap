import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMonthlyReport } from '../../src/services/api';

interface ShopInvoice {
  invoice_id: string;
  invoice_date: string;
  total_amount: number;
  item_count: number;
}

interface ShopReport {
  shop_name: string;
  total_amount: number;
  invoice_count: number;
  invoices: ShopInvoice[];
}

interface MonthlyReport {
  year: number;
  month: number;
  shops: ShopReport[];
  total_amount: number;
  total_invoices: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [expandedShop, setExpandedShop] = useState<string | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const data = await getMonthlyReport(selectedYear, selectedMonth);
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    setLoading(true);
    loadReport();
  }, [loadReport]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReport();
  }, [loadReport]);

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setShowMonthPicker(false);
  };

  const handleYearChange = (delta: number) => {
    setSelectedYear(prev => prev + delta);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Billing Reports</Text>
      </View>

      {/* Month/Year Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity 
          style={styles.yearButton}
          onPress={() => handleYearChange(-1)}
        >
          <Ionicons name="chevron-back" size={24} color="#94a3b8" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.monthButton}
          onPress={() => setShowMonthPicker(!showMonthPicker)}
        >
          <Text style={styles.monthText}>{MONTHS[selectedMonth - 1]} {selectedYear}</Text>
          <Ionicons name={showMonthPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#94a3b8" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.yearButton}
          onPress={() => handleYearChange(1)}
        >
          <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Month Picker Dropdown */}
      {showMonthPicker && (
        <View style={styles.monthPicker}>
          {MONTHS.map((month, index) => (
            <TouchableOpacity
              key={month}
              style={[
                styles.monthOption,
                selectedMonth === index + 1 && styles.monthOptionSelected,
              ]}
              onPress={() => handleMonthChange(index + 1)}
            >
              <Text style={[
                styles.monthOptionText,
                selectedMonth === index + 1 && styles.monthOptionTextSelected,
              ]}>
                {month}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>₹{(report?.total_amount || 0).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Billing</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{report?.total_invoices || 0}</Text>
          <Text style={styles.summaryLabel}>Invoices</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{report?.shops?.length || 0}</Text>
          <Text style={styles.summaryLabel}>Shops</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {(!report?.shops || report.shops.length === 0) ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#64748b" />
            <Text style={styles.emptyTitle}>No Data for This Month</Text>
            <Text style={styles.emptySubtitle}>Scan invoices to see billing reports</Text>
          </View>
        ) : (
          report.shops.map((shop) => (
            <View key={shop.shop_name} style={styles.shopCard}>
              <TouchableOpacity
                style={styles.shopHeader}
                onPress={() => setExpandedShop(prev => prev === shop.shop_name ? null : shop.shop_name)}
              >
                <View style={styles.shopInfo}>
                  <View style={styles.shopIcon}>
                    <Ionicons name="storefront" size={24} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.shopName}>{shop.shop_name}</Text>
                    <Text style={styles.shopMeta}>{shop.invoice_count} invoice(s)</Text>
                  </View>
                </View>
                <View style={styles.shopTotal}>
                  <Text style={styles.shopTotalAmount}>₹{shop.total_amount.toLocaleString()}</Text>
                  <Ionicons 
                    name={expandedShop === shop.shop_name ? 'chevron-up' : 'chevron-down'} 
                    size={20} 
                    color="#64748b" 
                  />
                </View>
              </TouchableOpacity>

              {expandedShop === shop.shop_name && (
                <View style={styles.shopInvoices}>
                  {shop.invoices.map((invoice, index) => (
                    <View key={invoice.invoice_id || index} style={styles.invoiceRow}>
                      <View style={styles.invoiceDate}>
                        <Ionicons name="calendar-outline" size={14} color="#64748b" />
                        <Text style={styles.invoiceDateText}>
                          {invoice.invoice_date || 'No date'}
                        </Text>
                      </View>
                      <View style={styles.invoiceDetails}>
                        <Text style={styles.invoiceItems}>{invoice.item_count} items</Text>
                        <Text style={styles.invoiceAmount}>
                          ₹{(invoice.total_amount || 0).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  yearButton: {
    padding: 8,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  monthText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  monthPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  monthOption: {
    width: '25%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  monthOptionSelected: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  monthOptionText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  monthOptionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#334155',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  shopCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  shopMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  shopTotal: {
    alignItems: 'flex-end',
  },
  shopTotalAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
  },
  shopInvoices: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 16,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  invoiceDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceDateText: {
    fontSize: 14,
    color: '#94a3b8',
    marginLeft: 8,
  },
  invoiceDetails: {
    alignItems: 'flex-end',
  },
  invoiceItems: {
    fontSize: 12,
    color: '#64748b',
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#e2e8f0',
    marginTop: 2,
  },
});
