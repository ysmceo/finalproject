import 'react-native-gesture-handler';

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StyleSheet, View } from 'react-native';

import HomeWebScreen from './src/screens/HomeWebScreen';
import BookScreen from './src/screens/BookScreen';
import TrackScreen from './src/screens/TrackScreen';
import AdminScreen from './src/screens/AdminScreen';
import { ThemeProvider, useThemePrefs } from './src/theme';
import SettingsScreen from './src/screens/SettingsScreen';

export type RootTabParamList = {
  Home: undefined;
  Book: undefined;
  Track: { bookingId?: string; email?: string } | undefined;
  Admin: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App() {
  const content = (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );

  // PC preview: when running as a web app, constrain to a phone-like frame.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webStage}>
        <View style={styles.webHeader}>
          <View style={styles.badge}>
            <Ionicons name="phone-portrait-outline" size={16} color="#fff" />
          </View>
        </View>

        <View style={styles.deviceRow}
        >
          <View style={styles.deviceCol}>
            <View style={styles.deviceLabelRow}>
              <Ionicons name="logo-apple" size={14} color="#cfd5e3" />
              <View style={{ width: 6 }} />
              <Ionicons name="phone-portrait-outline" size={14} color="#cfd5e3" />
            </View>
            <View style={[styles.phoneFrame, styles.phoneFrameIphone]}>{content}</View>
          </View>

          <View style={styles.deviceCol}>
            <View style={styles.deviceLabelRow}>
              <Ionicons name="logo-android" size={14} color="#cfd5e3" />
              <View style={{ width: 6 }} />
              <Ionicons name="phone-portrait-outline" size={14} color="#cfd5e3" />
            </View>
            <View style={[styles.phoneFrame, styles.phoneFrameAndroid]}>{content}</View>
          </View>
        </View>
      </View>
    );
  }

  return (
    content
  );
}

function AppShell() {
  const { navigationTheme, resolvedColorScheme } = useThemePrefs();

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={resolvedColorScheme === 'dark' ? 'light' : 'dark'} />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerTitleAlign: 'center',
            tabBarActiveTintColor: '#b78a2a',
            tabBarInactiveTintColor: '#666',
            tabBarIcon: ({ color, size }) => {
              const name = (() => {
                switch (route.name) {
                  case 'Home':
                    return 'globe-outline';
                  case 'Book':
                    return 'calendar-outline';
                  case 'Track':
                    return 'search-outline';
                  case 'Admin':
                    return 'shield-checkmark-outline';
                  case 'Settings':
                    return 'settings-outline';
                  default:
                    return 'ellipse-outline';
                }
              })();
              return <Ionicons name={name} size={size} color={color} />;
            }
          })}
        >
          <Tab.Screen name="Home" component={HomeWebScreen} options={{ title: 'Website' }} />
          <Tab.Screen name="Book" component={BookScreen} options={{ title: 'Book' }} />
          <Tab.Screen name="Track" component={TrackScreen} options={{ title: 'Track' }} />
          <Tab.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  webStage: {
    flex: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1115',
    paddingVertical: 24,
    paddingHorizontal: 12
  },
  webHeader: {
    width: '100%',
    maxWidth: 920,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 14
  },
  badge: {
    backgroundColor: '#2a2f3a',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999
  },
  deviceRow: {
    width: '100%',
    maxWidth: 920,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 18
  },
  deviceCol: {
    alignItems: 'center',
    gap: 10
  },
  deviceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  phoneFrame: {
    width: 390, // iPhone 14-ish logical width
    maxWidth: '100%',
    height: 844, // iPhone 14-ish logical height
    // Web-only CSS unit; RN native types don't include 'vh'.
    maxHeight: '92vh' as any,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 10,
    borderColor: '#1b1f29',
    backgroundColor: '#fff',
    // Shadow (web)
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 }
  },
  phoneFrameIphone: {
    width: 390,
    height: 844,
    borderRadius: 28
  },
  phoneFrameAndroid: {
    width: 360,
    height: 800,
    borderRadius: 22
  }
});
