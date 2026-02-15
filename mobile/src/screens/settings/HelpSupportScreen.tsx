import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { WEB_BASE_URL } from '../../config';
import { SettingsCard, SettingsRow, SettingsSectionTitle } from './ui';

export default function HelpSupportScreen() {
  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open', url);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsSectionTitle>Help</SettingsSectionTitle>
      <SettingsCard>
        <SettingsRow icon="globe-outline" title="Open website" subtitle={WEB_BASE_URL} onPress={() => open(WEB_BASE_URL)} noTopBorder />
        <SettingsRow
          icon="document-text-outline"
          title="How booking works"
          subtitle="Create booking → Track status → Upload receipt (if bank transfer)"
        />
      </SettingsCard>

      <SettingsSectionTitle>Support</SettingsSectionTitle>
      <SettingsCard>
        <View style={styles.pad}>
          <Text style={styles.text}>
            If something isn’t loading on a phone, confirm the phone can open your backend URL over Wi‑Fi.
          </Text>
          <Text style={[styles.text, { marginTop: 8, color: '#6b7280' }]}>Tip: Windows Firewall must allow port 3000.</Text>
        </View>
      </SettingsCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30
  },
  pad: {
    padding: 14
  },
  text: {
    color: '#111827',
    lineHeight: 20
  }
});
