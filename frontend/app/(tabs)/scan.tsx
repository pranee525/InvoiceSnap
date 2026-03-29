import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { scanInvoice } from '../../src/services/api';
import { useRouter } from 'expo-router';

interface ScanResult {
  invoice_id: string;
  shop_name: string;
  invoice_date: string;
  total_amount: number;
  items: Array<{
    product_name: string;
    batch_no: string;
    expiry_date: string;
    quantity: number;
    amount: number;
  }>;
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.8,
        });
        
        if (photo?.base64) {
          setShowCamera(false);
          setCapturedImage(`data:image/jpeg;base64,${photo.base64}`);
          await processImage(photo.base64);
        }
      } catch (error) {
        console.error('Failed to take picture:', error);
        Alert.alert('Error', 'Failed to capture image');
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const base64 = result.assets[0].base64;
        setCapturedImage(`data:image/jpeg;base64,${base64}`);
        await processImage(base64);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const processImage = async (base64: string) => {
    setScanning(true);
    setResult(null);
    
    try {
      const data = await scanInvoice(base64);
      setResult(data);
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert('Scan Failed', error.message || 'Failed to extract invoice data');
    } finally {
      setScanning(false);
    }
  };

  const resetScan = () => {
    setResult(null);
    setCapturedImage(null);
  };

  // Show camera permission request
  if (showCamera && !permission?.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#64748b" />
          <Text style={styles.permissionText}>Camera access is required to scan invoices</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => setShowCamera(false)}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show camera view
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          <View style={[styles.cameraOverlay, { paddingTop: insets.top }]}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.cameraControls}>
            <Text style={styles.cameraHint}>Position the invoice within the frame</Text>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // Show scan result
  if (result) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scan Result</Text>
          <TouchableOpacity onPress={resetScan}>
            <Text style={styles.headerAction}>New Scan</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.resultContainer}>
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            <Text style={styles.successText}>Invoice scanned successfully!</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultShopName}>{result.shop_name}</Text>
            <View style={styles.resultMeta}>
              <Text style={styles.resultDate}>{result.invoice_date || 'Date not found'}</Text>
              {result.total_amount && (
                <Text style={styles.resultTotal}>₹{result.total_amount.toLocaleString()}</Text>
              )}
            </View>
          </View>

          <Text style={styles.itemsTitle}>{result.items.length} Items Extracted</Text>
          {result.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                {item.amount && (
                  <Text style={styles.itemAmount}>₹{item.amount}</Text>
                )}
              </View>
              <View style={styles.itemDetails}>
                {item.batch_no && (
                  <Text style={styles.itemDetail}>Batch: {item.batch_no}</Text>
                )}
                {item.expiry_date && (
                  <Text style={styles.itemDetail}>Exp: {item.expiry_date}</Text>
                )}
                {item.quantity && (
                  <Text style={styles.itemDetail}>Qty: {item.quantity}</Text>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity 
            style={styles.viewInvoicesButton}
            onPress={() => router.push('/(tabs)/invoices')}
          >
            <Text style={styles.viewInvoicesText}>View All Invoices</Text>
            <Ionicons name="arrow-forward" size={20} color="#3b82f6" />
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    );
  }

  // Show scanning state
  if (scanning) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.scanningContainer}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          )}
          <View style={styles.scanningOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.scanningText}>Analyzing invoice...</Text>
            <Text style={styles.scanningSubtext}>Extracting shop, items, and expiry dates</Text>
          </View>
        </View>
      </View>
    );
  }

  // Default: Show scan options
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan Invoice</Text>
      </View>

      <View style={styles.optionsContainer}>
        <Text style={styles.instructionText}>
          Scan a pharmaceutical invoice to extract items, batch numbers, and expiry dates
        </Text>

        <TouchableOpacity style={styles.optionCard} onPress={() => setShowCamera(true)}>
          <View style={[styles.optionIcon, { backgroundColor: '#1e3a5f' }]}>
            <Ionicons name="camera" size={40} color="#3b82f6" />
          </View>
          <Text style={styles.optionTitle}>Take Photo</Text>
          <Text style={styles.optionSubtitle}>Use camera to capture invoice</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionCard} onPress={pickImage}>
          <View style={[styles.optionIcon, { backgroundColor: '#1e3a3a' }]}>
            <Ionicons name="images" size={40} color="#22c55e" />
          </View>
          <Text style={styles.optionTitle}>Choose from Gallery</Text>
          <Text style={styles.optionSubtitle}>Select an existing photo</Text>
        </TouchableOpacity>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips for best results:</Text>
          <View style={styles.tipItem}>
            <Ionicons name="sunny" size={18} color="#f59e0b" />
            <Text style={styles.tipText}>Ensure good lighting</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="scan" size={18} color="#f59e0b" />
            <Text style={styles.tipText}>Capture the entire invoice</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="phone-portrait" size={18} color="#f59e0b" />
            <Text style={styles.tipText}>Keep the phone steady</Text>
          </View>
        </View>
      </View>
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
  headerAction: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  optionsContainer: {
    flex: 1,
    padding: 20,
  },
  instructionText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  optionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  optionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  tipsContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#94a3b8',
    marginLeft: 8,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 40,
    alignItems: 'center',
  },
  cameraHint: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    padding: 12,
  },
  backButtonText: {
    color: '#64748b',
    fontSize: 16,
  },
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '80%',
    height: '50%',
    borderRadius: 12,
    opacity: 0.3,
  },
  scanningOverlay: {
    position: 'absolute',
    alignItems: 'center',
  },
  scanningText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
  },
  scanningSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
  },
  resultContainer: {
    flex: 1,
    padding: 20,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#052e16',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  resultCard: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  resultShopName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultDate: {
    fontSize: 14,
    color: '#94a3b8',
  },
  resultTotal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#22c55e',
  },
  itemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  itemDetail: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 12,
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  viewInvoicesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  viewInvoicesText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
});
