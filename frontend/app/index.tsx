import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function Index() {
  const router = useRouter();
  const { user, loading, login, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      if (url.includes('session_id=')) {
        const sessionId = url.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          setIsLoggingIn(true);
          try {
            await login(sessionId);
          } catch (error) {
            console.error('Login failed:', error);
          } finally {
            setIsLoggingIn(false);
          }
        }
      }
    };

    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    // Listen for URL changes
    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [login]);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, loading, router]);

  const handleGoogleLogin = async () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = Platform.OS === 'web' 
      ? window.location.origin 
      : Linking.createURL('');
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const sessionId = result.url.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          setIsLoggingIn(true);
          try {
            await login(sessionId);
          } catch (error) {
            console.error('Login failed:', error);
          } finally {
            setIsLoggingIn(false);
          }
        }
      }
    }
  };

  if (loading || isLoggingIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>
          {isLoggingIn ? 'Signing you in...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="receipt" size={80} color="#3b82f6" />
        </View>
        
        <Text style={styles.title}>Invoice Scanner</Text>
        <Text style={styles.subtitle}>
          Scan pharmaceutical invoices, track medicine expiry dates, and generate billing reports
        </Text>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Ionicons name="camera" size={24} color="#22c55e" />
            <Text style={styles.featureText}>Scan & Extract Data</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="alarm" size={24} color="#f59e0b" />
            <Text style={styles.featureText}>Expiry Reminders</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="bar-chart" size={24} color="#8b5cf6" />
            <Text style={styles.featureText}>Billing Reports</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  features: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 12,
  },
  featureText: {
    color: '#e2e8f0',
    fontSize: 16,
    marginLeft: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
});
