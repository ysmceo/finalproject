import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

import { API_BASE_URL, WEB_BASE_URL, buildApiUrl } from '../../config';
import { SettingsCard, SettingsPill, SettingsRow, SettingsSectionTitle } from './ui';

const LAST_BOOKING_ID_KEY = 'ceosalon:lastBookingId';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';

export default function AccountScreen() {
  const [lastBookingId, setLastBookingId] = useState<string>('');
  const [lastBookingEmail, setLastBookingEmail] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [apiStatus, setApiStatus] = useState<string>('');

  const adminUrl = useMemo(() => `${WEB_BASE_URL.replace(/\/+$/, '')}/admin`, []);

  useEffect(() => {
    (async () => {
      const [id, email] = await Promise.all([
        AsyncStorage.getItem(LAST_BOOKING_ID_KEY),
        AsyncStorage.getItem(LAST_BOOKING_EMAIL_KEY)
      ]);
      setLastBookingId(id || '');
      setLastBookingEmail(email || '');
    })().catch(() => undefined);
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

  async function clearSavedBooking() {
    Alert.alert('Clear saved booking?', 'This removes the last Booking ID/Email stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove([LAST_BOOKING_ID_KEY, LAST_BOOKING_EMAIL_KEY]);
          setLastBookingId('');
          setLastBookingEmail('');
          Alert.alert('Done', 'Saved booking cleared.');
        }
      }
    ]);
  }

  async function testApi() {
    setTesting(true);
    setApiStatus('');
    try {
      const res = await fetch(buildApiUrl('/api/services'), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      setApiStatus(res.ok ? '✅ API reachable' : `⚠️ API error (HTTP ${res.status})`);
    } catch (e) {
      setApiStatus(e instanceof Error ? `⚠️ ${e.message}` : '⚠️ Failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsSectionTitle>Saved booking</SettingsSectionTitle>
      <SettingsCard>
        <SettingsRow icon="bookmark-outline" title="Last Booking ID" subtitle={lastBookingId || 'Not set'} noTopBorder />
        <SettingsRow icon="mail-outline" title="Last Booking Email" subtitle={lastBookingEmail || 'Not set'} />
        <View style={styles.pills}>
          <SettingsPill label="Clear" onPress={clearSavedBooking} variant="danger" />
        </View>
      </SettingsCard>

      <SettingsSectionTitle>Links</SettingsSectionTitle>
      <SettingsCard>
        <SettingsRow icon="globe-outline" title="Open Website" subtitle={WEB_BASE_URL} onPress={() => open(WEB_BASE_URL)} noTopBorder />
        <SettingsRow icon="shield-checkmark-outline" title="Open Admin" subtitle={adminUrl} onPress={() => open(adminUrl)} />
        <View style={styles.pills}>
          <SettingsPill label="Copy WEB" onPress={() => copy(WEB_BASE_URL, 'WEB_BASE_URL')} variant="ghost" />
          <SettingsPill label="Copy API" onPress={() => copy(API_BASE_URL, 'API_BASE_URL')} variant="ghost" />
          <SettingsPill label={testing ? 'Testing…' : 'Test API'} onPress={testApi} variant="primary" />
        </View>
        {apiStatus ? <Text style={styles.status}>{apiStatus}</Text> : null}
      </SettingsCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30
  },
  pills: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  status: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    color: '#374151',
    fontWeight: '700'
  }
});
