import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { WEB_BASE_URL } from '../config';

export default function HomeWebScreen() {
  const [loadError, setLoadError] = useState<string | null>(null);

  const startUrl = useMemo(() => {
    // Keep it simple: load the public website root.
    return WEB_BASE_URL;
  }, []);

  // IMPORTANT: react-native-webview is not supported on Expo Web.
  // Also: importing it at the top-level can break the web bundle.
  // So we only require it on native platforms.
  const NativeWebView: any = useMemo(() => {
    if (Platform.OS === 'web') return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-webview').WebView;
  }, []);

  // PC preview (web): show the website in an iframe.
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe
          title="CEO Salon Website"
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
        <Text style={styles.errorTitle}>Can’t load the website</Text>
        <Text style={styles.errorText}>Tried: {startUrl}</Text>
        <Text style={styles.errorText}>Error: {loadError}</Text>

        <Text style={[styles.errorText, { marginTop: 10 }]}>
          If you’re on a physical device, “localhost” won’t work — use your computer’s LAN IP.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setLoadError(null);
          }}
        >
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
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <NativeWebView
        source={{ uri: startUrl }}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode={Platform.OS === 'android' ? 'always' : 'never'}
        allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 10 }}>Loading…</Text>
          </View>
        )}
        onError={(e: any) => {
          setLoadError(e?.nativeEvent?.description || 'WebView failed to load');
        }}
        onHttpError={(e: any) => {
          const code = e?.nativeEvent?.statusCode;
          setLoadError(code ? `HTTP ${code}` : 'HTTP error');
        }}
        onShouldStartLoadWithRequest={(req: any) => {
          const url = String(req.url || '');

          // Keep tel/mailto (and external schemes) in native apps.
          if (/^(tel:|mailto:|sms:)/i.test(url)) {
            Linking.openURL(url).catch(() => undefined);
            return false;
          }

          // Allow the site itself.
          if (url.startsWith(startUrl)) return true;
          if (url.startsWith('http://') || url.startsWith('https://')) return true;
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#fff'
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800'
  },
  errorText: {
    marginTop: 10,
    color: '#444'
  },
  button: {
    marginTop: 14,
    backgroundColor: '#b78a2a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800'
  },
  buttonAlt: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#b78a2a'
  },
  buttonAltText: {
    color: '#b78a2a'
  }
});
