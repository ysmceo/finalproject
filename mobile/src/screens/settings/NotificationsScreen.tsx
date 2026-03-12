import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsCard, SettingsSectionTitle } from './ui';
import { useThemePrefs } from '../../theme';
import { getMobilePalette } from '../../ui/polish';

export default function NotificationsScreen() {
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]}>
      <SettingsSectionTitle>In-app notifications</SettingsSectionTitle>
      <SettingsCard>
        <View style={styles.pad}>
          <Text style={[styles.text, { color: palette.text }]}>
            This app shows booking updates and messages inside the Track tab (Notifications list).
          </Text>
          <Text style={[styles.text, { marginTop: 10, color: palette.textMuted }]}>
            Push notifications (phone alerts) are not enabled yet.
          </Text>
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
