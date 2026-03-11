import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { WEB_BASE_URL, WEB_BASE_URL_CANDIDATES } from '../config';
import { useThemePrefs } from '../theme';
import { getMobilePalette, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';

type HomeWebScreenRouteParams = {
  /**
   * Optional website path/hash to open from WEB_BASE_URL.
   * Examples: '#booking', '#track-booking', '/admin'
   */
  initialPath?: string;
};

type HomeWebScreenProps = {
  route?: {
    params?: HomeWebScreenRouteParams;
  };
};

export default function HomeWebScreen({ route }: HomeWebScreenProps) {
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolvedBaseUrl, setResolvedBaseUrl] = useState<string>(WEB_BASE_URL);
  const [resolvingBaseUrl, setResolvingBaseUrl] = useState<boolean>(true);
  const [reloadVersion, setReloadVersion] = useState<number>(0);

  const resolveReachableBaseUrl = useCallback(async () => {
    setResolvingBaseUrl(true);

    const candidates = Array.isArray(WEB_BASE_URL_CANDIDATES) && WEB_BASE_URL_CANDIDATES.length
      ? WEB_BASE_URL_CANDIDATES
      : [WEB_BASE_URL];

    for (const candidate of candidates) {
      const base = String(candidate || '').replace(/\/+$/, '');
      if (!base) continue;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      try {
        const probe = await fetch(`${base}/api/products`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });

        if (!probe.ok) continue;

        const data = await probe.json().catch(() => null);
        if (!Array.isArray(data)) continue;

        setResolvedBaseUrl(base);
        setResolvingBaseUrl(false);
        setLoadError(null);
        return;
      } catch {
        // Try next candidate.
      } finally {
        clearTimeout(timeout);
      }
    }

    setResolvedBaseUrl(String(WEB_BASE_URL || '').replace(/\/+$/, ''));
    setResolvingBaseUrl(false);
    setLoadError('Unable to reach website server. Please ensure backend is running and reachable from this device.');
  }, []);

  useEffect(() => {
    resolveReachableBaseUrl();
  }, [resolveReachableBaseUrl, reloadVersion]);

  const startUrl = useMemo(() => {
    // Keep it simple: load the public website root or a specific section.
    const initialPath = String(route?.params?.initialPath || '').trim();
    const base = String(resolvedBaseUrl || WEB_BASE_URL).replace(/\/+$/, '');

    if (!initialPath) return base;

    if (initialPath.startsWith('#')) {
      return `${base}/${initialPath}`;
    }

    const normalizedPath = initialPath.startsWith('/') ? initialPath : `/${initialPath}`;
    return `${base}${normalizedPath}`;
  }, [resolvedBaseUrl, route?.params?.initialPath]);

  if (resolvingBaseUrl) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={{ marginTop: 10, color: palette.textMuted }}>Connecting to website…</Text>
      </View>
    );
  }

  const handleRetry = () => {
    setLoadError(null);
    setReloadVersion(prev => prev + 1);
  };

  const connectionLabel = useMemo(() => {
    const value = String(resolvedBaseUrl || WEB_BASE_URL).trim();
    if (!value) return 'Connected: unknown';
    return `Connected: ${value}`;
  }, [resolvedBaseUrl]);

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
        <View style={[styles.connectionBanner, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
          <Text numberOfLines={1} style={[styles.connectionBannerText, { color: palette.textMuted }]}>{connectionLabel}</Text>
        </View>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe
          key={`${startUrl}:${reloadVersion}`}
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
          onPress={handleRetry}
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
      <View style={[styles.connectionBanner, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
        <Text numberOfLines={1} style={[styles.connectionBannerText, { color: palette.textMuted }]}>{connectionLabel}</Text>
      </View>
      <NativeWebView
        key={`${startUrl}:${reloadVersion}`}
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
        onLoad={() => {
          setLoadError(null);
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
  connectionBanner: {
    marginHorizontal: MOBILE_SPACE.lg,
    marginTop: MOBILE_SPACE.md,
    marginBottom: MOBILE_SPACE.xs,
    borderRadius: MOBILE_SHAPE.chipRadius,
    borderWidth: 1,
    paddingHorizontal: MOBILE_SPACE.md,
    paddingVertical: MOBILE_SPACE.xs
  },
  connectionBannerText: {
    fontSize: MOBILE_TYPE.micro,
    fontWeight: '700'
  },
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
