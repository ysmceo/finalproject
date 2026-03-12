import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsCard, SettingsSectionTitle } from './ui';
import { useThemePrefs } from '../../theme';
import { getMobilePalette } from '../../ui/polish';

export default function AppearanceScreen() {
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]}>
      <SettingsSectionTitle>Appearance</SettingsSectionTitle>
      <SettingsCard>
        <View style={styles.pad}>
          <Text style={[styles.text, { color: palette.text }]}>
            Choose light, dark, or system mode from the main mobile More page or the header toggle.
          </Text>
          <Text style={[styles.text, { marginTop: 10, color: palette.textMuted }]}>
            Theme colors now follow the shared mobile palette so surfaces and text stay readable in both schemes.
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
