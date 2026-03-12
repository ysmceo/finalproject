import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { WEB_BASE_URL } from '../../config';
import { SettingsCard, SettingsRow, SettingsSectionTitle } from './ui';
import { useThemePrefs } from '../../theme';
import { getMobilePalette } from '../../ui/polish';

const CUSTOMER_CARE_PHONE = '07036939125';
const CUSTOMER_CARE_EMAIL = 'okontaysm@gmail.com';
const CUSTOMER_CARE_WHATSAPP = 'https://wa.me/2347036939125';

export default function HelpSupportScreen() {
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');

  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open', url);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]}>
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
        <SettingsRow
          icon="logo-whatsapp"
          title="Priority WhatsApp Support"
          subtitle="Fastest route for urgent booking and payment issues"
          onPress={() => open(CUSTOMER_CARE_WHATSAPP)}
          noTopBorder
        />
        <SettingsRow
          icon="call-outline"
          title="Call Customer Care"
          subtitle={CUSTOMER_CARE_PHONE}
          onPress={() => open(`tel:${CUSTOMER_CARE_PHONE}`)}
        />
        <SettingsRow
          icon="mail-outline"
          title="Email Customer Care"
          subtitle={CUSTOMER_CARE_EMAIL}
          onPress={() => open(`mailto:${CUSTOMER_CARE_EMAIL}`)}
        />
        <View style={styles.pad}>
          <Text style={[styles.text, { color: palette.text }]}>
            Service-level response guide: Normal (&lt;24 hours), Priority (4-8 hours), Urgent (same day support).
          </Text>
          <Text style={[styles.text, { marginTop: 8, color: palette.textMuted }]}>
            If something isn’t loading on a phone, confirm the phone can open your backend URL over Wi‑Fi.
          </Text>
          <Text style={[styles.text, { marginTop: 8, color: palette.textMuted }]}>Tip: Windows Firewall must allow port 3000.</Text>
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
  pad: {
    padding: 14
  },
  text: {
    color: '#2f2745',
    lineHeight: 20
  }
});
