import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SettingsHomeScreen from './settings/SettingsHomeScreen';
import AccountScreen from './settings/AccountScreen';
import NotificationsScreen from './settings/NotificationsScreen';
import AppearanceScreen from './settings/AppearanceScreen';
import PrivacySecurityScreen from './settings/PrivacySecurityScreen';
import HelpSupportScreen from './settings/HelpSupportScreen';
import AboutScreen from './settings/AboutScreen';

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Account: undefined;
  Notifications: undefined;
  Appearance: undefined;
  PrivacySecurity: undefined;
  HelpSupport: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SettingsHome" component={SettingsHomeScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: 'Appearance' }} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} options={{ title: 'Privacy & Security' }} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: 'Help & Support' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
    </Stack.Navigator>
  );
}
