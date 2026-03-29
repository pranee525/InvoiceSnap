import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('session_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export async function scanInvoice(imageBase64: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/invoices/scan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to scan invoice');
  }

  return response.json();
}

export async function getInvoices() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/invoices`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch invoices');
  }

  return response.json();
}

export async function getInvoice(invoiceId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/invoices/${invoiceId}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch invoice');
  }

  return response.json();
}

export async function deleteInvoice(invoiceId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/invoices/${invoiceId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to delete invoice');
  }

  return response.json();
}

export async function getExpiryAlerts() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/expiry-alerts`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch expiry alerts');
  }

  return response.json();
}

export async function getMonthlyReport(year: number, month: number) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/reports/monthly?year=${year}&month=${month}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch monthly report');
  }

  return response.json();
}

export async function getSummary() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/reports/summary`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch summary');
  }

  return response.json();
}
