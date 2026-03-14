import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { WEB_BASE_URL } from '../config';

export default function AdminWebScreen() {
  const [loadError, setLoadError] = useState<string | null>(null);

  const startUrl = useMemo(() => {
    return `${WEB_BASE_URL.replace(/\/+$/, '')}/admin`;
  }, []);

  // IMPORTANT: react-native-webview is not supported on Expo Web.
  // Also: importing it at the top-level can break the web bundle.
  const NativeWebView: any = useMemo(() => {
    if (Platform.OS === 'web') return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-webview').WebView;
  }, []);

  // NOTE: react-native-webview is not supported on Expo Web.
  // For PC preview, embed the admin page with an iframe.
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: '#7c46e8', padding: 0 }}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe
          title="CEO Salon Admin"
          src={startUrl}
          width="100%"
          height="100%"
          frameBorder="0"
        />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorTitle}>Can’t load Admin</Text>
        <Text style={styles.errorText}>Tried: {startUrl}</Text>
        <Text style={styles.errorText}>Error: {loadError}</Text>

        <TouchableOpacity style={styles.button} onPress={() => setLoadError(null)}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonAlt]}
          onPress={() => {
            Linking.openURL(startUrl).catch(() => undefined);
          }}
        >
          <Text style={[styles.buttonText, styles.buttonAltText]}>Open in browser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f8fc', padding: 0 }}>
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Text style={styles.headerSubtitle}>Manage your salon with style</Text>
      </View>
      <NativeWebView
        source={{ uri: startUrl }}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode={Platform.OS === 'android' ? 'always' : 'never'}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#46e8c6" />
            <Text style={{ marginTop: 10, color: '#7c46e8', fontWeight: '700' }}>Loading Admin…</Text>
          </View>
        )}
        onError={(e: any) => {
          setLoadError(e?.nativeEvent?.description || 'WebView failed to load');
        }}
        onHttpError={(e: any) => {
          const code = e?.nativeEvent?.statusCode;
          setLoadError(code ? `HTTP ${code}` : 'HTTP error');
        }}
        style={{ borderRadius: 18, margin: 16, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#7c46e8', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 8 }, shadowRadius: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#7c46e8',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#7c46e8',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    marginBottom: 8
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0d7fa',
    marginBottom: 2
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorWrap: {
    flex: 1,
    padding: 18,
    alignItems: 'stretch',
    justifyContent: 'center',
    backgroundColor: '#f6f8fc'
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2d2342'
  },
  errorText: {
    marginTop: 10,
    color: '#5e5873'
  },
  button: {
    marginTop: 14,
    backgroundColor: '#46e8c6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#46e8c6',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800'
  },
  buttonAlt: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#46e8c6'
  },
  buttonAltText: {
    color: '#7c46e8'
  }
});
