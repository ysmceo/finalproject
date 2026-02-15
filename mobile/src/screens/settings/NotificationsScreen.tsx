import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsCard, SettingsSectionTitle } from './ui';

export default function NotificationsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsSectionTitle>In-app notifications</SettingsSectionTitle>
      <SettingsCard>
        <View style={styles.pad}>
          <Text style={styles.text}>
            This app shows booking updates and messages inside the Track tab (Notifications list).
          </Text>
          <Text style={[styles.text, { marginTop: 10, color: '#6b7280' }]}>
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
