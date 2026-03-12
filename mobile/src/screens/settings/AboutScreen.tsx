import React, { useMemo, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';

import { API_BASE_URL, WEB_BASE_URL, buildApiUrl } from '../../config';
import { SettingsCard, SettingsPill, SettingsRow, SettingsSectionTitle } from './ui';
import { useThemePrefs } from '../../theme';
import { getMobilePalette } from '../../ui/polish';

export default function AboutScreen() {
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string>('');

  const appInfo = useMemo(() => {
    const cfg: any = (Constants as any).expoConfig || (Constants as any).manifest || {};
    const name = String(cfg?.name || 'Mobile App');
    const version = String(cfg?.version || '');
    const sdk = String((Constants as any)?.expoConfig?.sdkVersion || (Constants as any)?.manifest?.sdkVersion || '');
    const runtime = String((Constants as any)?.expoRuntimeVersion || cfg?.runtimeVersion || '');
    return { name, version, sdk, runtime };
  }, []);

  async function copy(text: string, label: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied.`);
  }

  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open', url);
    }
  }

  async function testApi() {
    setTesting(true);
    setStatus('');
    try {
      const res = await fetch(buildApiUrl('/api/services'), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      setStatus(res.ok ? '✅ API reachable' : `⚠️ API error (HTTP ${res.status})`);
    } catch (e) {
      setStatus(e instanceof Error ? `⚠️ ${e.message}` : '⚠️ Failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]}>
      <SettingsSectionTitle>App</SettingsSectionTitle>
      <SettingsCard>
        <SettingsRow icon="apps-outline" title="Name" subtitle={appInfo.name} noTopBorder />
        {appInfo.version ? <SettingsRow icon="pricetag-outline" title="Version" subtitle={appInfo.version} /> : null}
        {appInfo.sdk ? <SettingsRow icon="cube-outline" title="Expo SDK" subtitle={appInfo.sdk} /> : null}
        {appInfo.runtime ? <SettingsRow icon="flash-outline" title="Runtime" subtitle={appInfo.runtime} /> : null}
        <SettingsRow icon="phone-portrait-outline" title="Platform" subtitle={Platform.OS} />
      </SettingsCard>

      <SettingsSectionTitle>Connection</SettingsSectionTitle>
      <SettingsCard>
        <SettingsRow icon="globe-outline" title="WEB_BASE_URL" subtitle={WEB_BASE_URL} noTopBorder />
        <SettingsRow icon="link-outline" title="API_BASE_URL" subtitle={API_BASE_URL} />
        <View style={styles.pills}>
          <SettingsPill label="Copy WEB" onPress={() => copy(WEB_BASE_URL, 'WEB_BASE_URL')} variant="ghost" />
          <SettingsPill label="Copy API" onPress={() => copy(API_BASE_URL, 'API_BASE_URL')} variant="ghost" />
          <SettingsPill label={testing ? 'Testing…' : 'Test API'} onPress={testApi} />
        </View>
        {status ? <Text style={[styles.status, { color: palette.text }]}>{status}</Text> : null}
        <View style={styles.pillsBottom}>
          <SettingsPill label="Open Website" onPress={() => open(WEB_BASE_URL)} variant="ghost" />
          <SettingsPill label="Open Admin" onPress={() => open(`${WEB_BASE_URL.replace(/\/+$/, '')}/admin`)} variant="ghost" />
        </View>
      </SettingsCard>

      <SettingsSectionTitle>Build</SettingsSectionTitle>
      <SettingsCard>
        <View style={styles.pad}>
          <Text style={[styles.text, { color: palette.text }]}>API test endpoint: {buildApiUrl('/api/services')}</Text>
          <Text style={[styles.text, { marginTop: 8, color: palette.textMuted }]}>If you’re on a phone and nothing loads, it’s usually the base URL or firewall.</Text>
        </View>
      </SettingsCard>

      <SettingsSectionTitle>Trust & Support</SettingsSectionTitle>
      <SettingsCard>
        <View style={styles.pad}>
          <Text style={[styles.badgeTitle, { color: palette.text }]}>Professional profile</Text>
          <Text style={[styles.text, { color: palette.text }]}>✅ Real-time booking and order tracking</Text>
          <Text style={[styles.text, { color: palette.text }]}>✅ WhatsApp and call support available</Text>
          <Text style={[styles.text, { color: palette.text }]}>✅ Mature, secure payment-ready experience</Text>
        </View>
        <View style={styles.pillsBottom}>
          <SettingsPill label="Call Salon" onPress={() => open('tel:07036939125')} variant="ghost" />
          <SettingsPill label="WhatsApp" onPress={() => open('https://wa.me/2347036939125')} variant="ghost" />
          <SettingsPill label="Email" onPress={() => open('mailto:okontaysm@gmail.com')} variant="ghost" />
        </View>
      </SettingsCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30,
    backgroundColor: '#f6f8fc'
  },
  pills: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  pillsBottom: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  status: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    color: '#4b3f69',
    fontWeight: '700'
  },
  pad: {
    padding: 14
  },
  text: {
    color: '#2f2745',
    lineHeight: 20
  },
  badgeTitle: {
    color: '#2f3b58',
    fontWeight: '800',
    marginBottom: 8
  }
});
