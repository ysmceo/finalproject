import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SettingsCard, SettingsPill, SettingsSectionTitle } from './ui';

const LAST_BOOKING_ID_KEY = 'ceosalon:lastBookingId';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';

export default function PrivacySecurityScreen() {
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const [id, email] = await Promise.all([
        AsyncStorage.getItem(LAST_BOOKING_ID_KEY),
        AsyncStorage.getItem(LAST_BOOKING_EMAIL_KEY)
      ]);
      setHasSaved(Boolean(id || email));
    })().catch(() => undefined);
  }, []);

  async function clearSavedBooking() {
    Alert.alert('Clear saved data?', 'Removes the last Booking ID/Email stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove([LAST_BOOKING_ID_KEY, LAST_BOOKING_EMAIL_KEY]);
          setHasSaved(false);
          Alert.alert('Done', 'Saved booking data cleared.');
        }
      }
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsSectionTitle>Privacy</SettingsSectionTitle>
      <SettingsCard>
        <View style={styles.pad}>
          <Text style={styles.text}>
            This app may store your last Booking ID and Email on-device to make tracking easier.
          </Text>
          <Text style={[styles.text, { marginTop: 8, color: '#6b7280' }]}>
            No payment card details are stored in the app.
          </Text>

          <View style={styles.pills}>
            <SettingsPill
              label={hasSaved ? 'Clear saved booking' : 'No saved booking to clear'}
              onPress={clearSavedBooking}
              variant="danger"
            />
          </View>
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
  },
  pills: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  }
});
