import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getInvoices, deleteInvoice } from '../../src/services/api';
import { useRouter } from 'expo-router';

interface InvoiceItem {
  product_name: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  amount: number;
}

interface Invoice {
  invoice_id: string;
  shop_name: string;
  invoice_date: string;
  total_amount: number;
  items: InvoiceItem[];
  created_at: string;
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      const data = await getInvoices();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInvoices();
  }, [loadInvoices]);

  const handleDelete = (invoiceId: string, shopName: string) => {
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete this invoice from ${shopName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvoice(invoiceId);
              setInvoices(prev => prev.filter(inv => inv.invoice_id !== invoiceId));
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete invoice');
            }
          },
        },
      ]
    );
  };

  const toggleExpand = (invoiceId: string) => {
    setExpandedId(prev => prev === invoiceId ? null : invoiceId);
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
        <Text style={styles.headerTitle}>Invoices</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/scan')}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {invoices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#64748b" />
          <Text style={styles.emptyTitle}>No Invoices Yet</Text>
          <Text style={styles.emptySubtitle}>Scan your first invoice to get started</Text>
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={() => router.push('/(tabs)/scan')}
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.scanButtonText}>Scan Invoice</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
        >
          {invoices.map((invoice) => (
            <View key={invoice.invoice_id} style={styles.invoiceCard}>
              <TouchableOpacity 
                style={styles.invoiceHeader}
                onPress={() => toggleExpand(invoice.invoice_id)}
              >
                <View style={styles.invoiceInfo}>
                  <Text style={styles.shopName}>{invoice.shop_name}</Text>
                  <Text style={styles.invoiceDate}>{invoice.invoice_date || 'Date not available'}</Text>
                </View>
                <View style={styles.invoiceMeta}>
                  {invoice.total_amount && (
                    <Text style={styles.totalAmount}>₹{invoice.total_amount.toLocaleString()}</Text>
                  )}
                  <View style={styles.itemCount}>
                    <Text style={styles.itemCountText}>{invoice.items.length} items</Text>
                  </View>
                </View>
                <Ionicons 
                  name={expandedId === invoice.invoice_id ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color="#64748b" 
                />
              </TouchableOpacity>

              {expandedId === invoice.invoice_id && (
                <View style={styles.expandedContent}>
                  <View style={styles.itemsList}>
                    {invoice.items.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.product_name}</Text>
                          <View style={styles.itemMeta}>
                            {item.batch_no && <Text style={styles.itemMetaText}>Batch: {item.batch_no}</Text>}
                            {item.expiry_date && (
                              <Text style={[
                                styles.itemMetaText,
                                styles.expiryText
                              ]}>Exp: {item.expiry_date}</Text>
                            )}
                            {item.quantity && <Text style={styles.itemMetaText}>Qty: {item.quantity}</Text>}
                          </View>
                        </View>
                        {item.amount && (
                          <Text style={styles.itemAmount}>₹{item.amount}</Text>
                        )}
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDelete(invoice.invoice_id, invoice.shop_name)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    <Text style={styles.deleteButtonText}>Delete Invoice</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  invoiceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  invoiceInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  invoiceDate: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  invoiceMeta: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
  },
  itemCount: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  itemCountText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 16,
  },
  itemsList: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  itemMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  itemMetaText: {
    fontSize: 12,
    color: '#64748b',
    marginRight: 12,
  },
  expiryText: {
    color: '#f59e0b',
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#450a0a',
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
});
