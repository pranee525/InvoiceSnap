import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

export default function Index() {
  const router = useRouter();
  const { user, loading, login, isAuthenticated, isVerified } = useAuth();
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

  // Redirect based on auth and verification status
  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (isVerified) {
        router.replace('/(tabs)');
      } else {
        router.replace('/verify');
      }
    }
  }, [isAuthenticated, isVerified, loading, router]);

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
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>
          {isLoggingIn ? 'Signing you in...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="medical" size={50} color="#22c55e" />
          </View>
          <Text style={styles.brandName}>MedEx</Text>
          <Text style={styles.brandSuffix}>Tracker</Text>
        </View>
        
        <Text style={styles.tagline}>
          Medicine Expiry & Invoice Tracker
        </Text>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: '#052e16' }]}>
              <Ionicons name="scan" size={22} color="#22c55e" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>AI Invoice Scanning</Text>
              <Text style={styles.featureDesc}>Extract data instantly from photos</Text>
            </View>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: '#422006' }]}>
              <Ionicons name="alarm" size={22} color="#f59e0b" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Expiry Reminders</Text>
              <Text style={styles.featureDesc}>Never miss expiring medicines</Text>
            </View>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: '#1e1b4b' }]}>
              <Ionicons name="stats-chart" size={22} color="#8b5cf6" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Billing Reports</Text>
              <Text style={styles.featureDesc}>Track purchases by shop & date</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
          <Ionicons name="logo-google" size={22} color="#fff" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service
        </Text>
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: '#052e16',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  brandName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  brandSuffix: {
    fontSize: 42,
    fontWeight: '300',
    color: '#fff',
  },
  tagline: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 40,
  },
  features: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    marginBottom: 12,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: 14,
    flex: 1,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  featureDesc: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 10,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
  footerText: {
    color: '#475569',
    fontSize: 12,
    marginTop: 20,
    textAlign: 'center',
  },
});
