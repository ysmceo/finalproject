import 'react-native-gesture-handler';

import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import HomeWebScreen from './src/screens/HomeWebScreen';
import BookScreen from './src/screens/BookScreen';
import TrackScreen from './src/screens/TrackScreen';
import AdminScreen from './src/screens/AdminScreen';
import { applyHapticPreset } from './src/lib/haptics';
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
  const [showIntro, setShowIntro] = useState(true);
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    applyHapticPreset('balanced');

    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true
      }),
      Animated.timing(introScale, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  const handleEnter = () => {
    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true
    }).start(() => {
      setShowIntro(false);
    });
  };

  if (showIntro) {
    return (
      <SafeAreaProvider>
        <View style={styles.introWrap}>
          <Animated.View style={[styles.introCard, { opacity: introOpacity, transform: [{ scale: introScale }] }]}>
            <Image source={require('./assets/splash-icon.png')} style={styles.introLogo} resizeMode="contain" />
            <Text style={styles.introBrand}>D CEO OFFICIAL UNISEX SALON APP</Text>
            <Text style={styles.introSub}>Welcome ✨</Text>
            <Pressable style={styles.enterButton} onPress={handleEnter}>
              <Text style={styles.enterButtonText}>Get Started</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={resolvedColorScheme === 'dark' ? 'light' : 'dark'} />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerTitleAlign: 'center',
            animation: 'shift',
            tabBarHideOnKeyboard: true,
            tabBarActiveTintColor: '#7c46e8',
            tabBarInactiveTintColor: resolvedColorScheme === 'dark' ? '#9aa0b6' : '#726b84',
            headerStyle: {
              backgroundColor: resolvedColorScheme === 'dark' ? '#111426' : '#ffffff'
            },
            headerShadowVisible: false,
            headerTitleStyle: {
              fontWeight: '900',
              color: resolvedColorScheme === 'dark' ? '#f7f8ff' : '#2d2342'
            },
            tabBarStyle: {
              height: 72,
              paddingTop: 8,
              paddingBottom: 10,
              borderTopWidth: 0,
              backgroundColor: resolvedColorScheme === 'dark' ? '#171b2e' : '#ffffff',
              shadowColor: '#15062f',
              shadowOpacity: resolvedColorScheme === 'dark' ? 0.45 : 0.12,
              shadowOffset: { width: 0, height: -4 },
              shadowRadius: 16,
              elevation: 12
            },
            tabBarLabelStyle: {
              fontWeight: '800',
              fontSize: 11,
              marginBottom: 2
            },
            tabBarIcon: ({ color, size, focused }) => {
              const name = (() => {
                switch (route.name) {
                  case 'Home':
                    return focused ? 'globe' : 'globe-outline';
                  case 'Book':
                    return focused ? 'calendar' : 'calendar-outline';
                  case 'Track':
                    return focused ? 'search' : 'search-outline';
                  case 'Admin':
                    return focused ? 'shield-checkmark' : 'shield-checkmark-outline';
                  case 'Settings':
                    return focused ? 'settings' : 'settings-outline';
                  default:
                    return 'ellipse-outline';
                }
              })();

              return <Ionicons name={name} size={focused ? size + 2 : size} color={color} />;
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
  },
  introWrap: {
    flex: 1,
    backgroundColor: '#1c1038',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  introCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: '#2a154f',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8
  },
  introLogo: {
    width: 94,
    height: 94,
    marginBottom: 14
  },
  introBrand: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 23,
    textAlign: 'center',
    letterSpacing: 0.5
  },
  introSub: {
    marginTop: 12,
    color: '#f4d98a',
    fontSize: 14,
    fontWeight: '700'
  },
  enterButton: {
    marginTop: 18,
    backgroundColor: '#f4d98a',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999
  },
  enterButtonText: {
    color: '#2a154f',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.4
  }
});
