import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { WEB_BASE_URL } from '../config';
import { useThemePrefs } from '../theme';
import { getMobilePalette, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';

export default function HomeWebScreen() {
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);
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
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
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
      <View style={[styles.errorWrap, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorTitle, { color: palette.text }]}>Can’t load the website</Text>
        <Text style={[styles.errorText, { color: palette.textMuted }]}>Tried: {startUrl}</Text>
        <Text style={[styles.errorText, { color: palette.textMuted }]}>Error: {loadError}</Text>

        <Text style={[styles.errorText, { marginTop: 10, color: palette.textMuted }]}>
          If you’re on a physical device, “localhost” won’t work — use your computer’s LAN IP.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.primary }]}
          onPress={() => {
            setLoadError(null);
          }}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonAlt, { backgroundColor: palette.primarySoft, borderColor: palette.border }]}
          onPress={() => {
            Linking.openURL(startUrl).catch(() => undefined);
          }}
        >
          <Text style={[styles.buttonText, styles.buttonAltText, { color: palette.primary }]}>Open in browser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
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
          <View style={[styles.loading, { backgroundColor: palette.bg }]}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={{ marginTop: 10, color: palette.textMuted }}>Loading…</Text>
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
    padding: MOBILE_SPACE.xxxl,
    alignItems: 'stretch',
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  errorTitle: {
    fontSize: MOBILE_TYPE.heading,
    fontWeight: '800'
  },
  errorText: {
    marginTop: MOBILE_SPACE.md,
    color: '#444',
    fontSize: MOBILE_TYPE.body
  },
  button: {
    marginTop: MOBILE_SPACE.xl,
    backgroundColor: '#b78a2a',
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: MOBILE_SPACE.lg,
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
