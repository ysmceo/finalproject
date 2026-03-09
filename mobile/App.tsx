import 'react-native-gesture-handler';

import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Animated, Image, ImageBackground, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import HomeWebScreen from './src/screens/HomeWebScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import TeamScreen from './src/screens/TeamScreen';
import ContactScreen from './src/screens/ContactScreen';
import BookScreen from './src/screens/BookScreen';
import TrackScreen from './src/screens/TrackScreen';
import AdminScreen from './src/screens/AdminScreen';
import { applyHapticPreset } from './src/lib/haptics';
import { ThemeProvider, useThemePrefs } from './src/theme';
import SettingsScreen from './src/screens/SettingsScreen';

export type RootTabParamList = {
  Home: undefined;
  Gallery: undefined;
  Team: undefined;
  Contact: undefined;
  Book: { initialPath?: string } | undefined;
  Track: { initialPath?: string } | undefined;
  Admin: { initialPath?: string } | undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App() {
  const renderContent = () => (
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

        <View style={styles.deviceRow}>
          <View style={styles.deviceCol}>
            <View style={styles.deviceLabelRow}>
              <Ionicons name="phone-portrait-outline" size={14} color="#cfd5e3" />
              <View style={{ width: 6 }} />
              <Text style={styles.deviceLabelText}>Mobile Preview</Text>
            </View>
            <View style={[styles.phoneFrame, styles.phoneFrameIphone]}>{renderContent()}</View>
          </View>
        </View>
      </View>
    );
  }

  return (
    renderContent()
  );
}

function AppShell() {
  const { navigationTheme, resolvedColorScheme } = useThemePrefs();
  const [showIntro, setShowIntro] = useState(true);
  const [introStage, setIntroStage] = useState<'landing' | 'welcome'>('landing');
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.96)).current;
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const WELCOME_MESSAGE_DURATION_MS = 5000;

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

    return () => {
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
    };
  }, []);

  const enterAppNow = () => {
    if (welcomeTimerRef.current) {
      clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    }

    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      setShowIntro(false);
    });
  };

  const handleEnter = () => {
    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true
    }).start(() => {
      setIntroStage('welcome');
      introOpacity.setValue(0);
      introScale.setValue(0.98);

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

      welcomeTimerRef.current = setTimeout(() => {
        enterAppNow();
      }, WELCOME_MESSAGE_DURATION_MS);
    });
  };

  if (showIntro) {
    return (
      <SafeAreaProvider>
        <View style={styles.introWrap}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80' }}
            style={styles.introBackdrop}
            imageStyle={styles.introBackdropImage}
          >
            <View style={styles.introBackdropTint} />
            <View style={styles.introGlowTop} />
            <View style={styles.introGlowBottom} />

            <Animated.View style={[styles.introCard, { opacity: introOpacity, transform: [{ scale: introScale }] }]}>
              <Image source={require('./assets/splash-icon.png')} style={styles.introLogo} resizeMode="contain" />
              <Text style={styles.introBrand}>D CEO OFFICIAL UNISEX SALON APP</Text>
              {introStage === 'landing' ? (
                <>
                  <Text style={styles.introSub}>Welcome ✨</Text>
                  <Pressable style={styles.enterButton} onPress={handleEnter}>
                    <Text style={styles.enterButtonText}>Get Started</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.welcomeTitle}>Your clean look starts with clean care ✨</Text>
                  <Text style={styles.welcomeBody}>
                    Fresh routines, clean tools, and healthy grooming choices build confidence every day.
                  </Text>
                  <Text style={styles.welcomeFootnote}>Preparing your premium salon experience…</Text>
                  <Pressable style={[styles.enterButton, styles.enterButtonAlt]} onPress={enterAppNow}>
                    <Text style={[styles.enterButtonText, styles.enterButtonTextAlt]}>Get Started</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </ImageBackground>
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
            sceneStyle: {
              backgroundColor: resolvedColorScheme === 'dark' ? '#0f111f' : '#f6f8fc'
            },
            tabBarHideOnKeyboard: true,
            tabBarActiveTintColor: '#7c46e8',
            tabBarInactiveTintColor: resolvedColorScheme === 'dark' ? '#9aa0b6' : '#726b84',
            headerStyle: {
              backgroundColor: resolvedColorScheme === 'dark' ? '#111426' : '#ffffff'
            },
            headerRight: () => (
              <View style={styles.headerBadge}>
                <Ionicons name="sparkles-outline" size={12} color="#5a31b3" />
                <Text style={styles.headerBadgeText}>CEO</Text>
              </View>
            ),
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
                    return focused ? 'home' : 'home-outline';
                  case 'Gallery':
                    return focused ? 'images' : 'images-outline';
                  case 'Team':
                    return focused ? 'people' : 'people-outline';
                  case 'Contact':
                    return focused ? 'call' : 'call-outline';
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

              return (
                <View style={[styles.tabIconBubble, focused && styles.tabIconBubbleFocused]}>
                  <Ionicons name={name} size={focused ? size + 1 : size} color={color} />
                </View>
              );
            }
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
          <Tab.Screen name="Gallery" component={GalleryScreen} options={{ title: 'Gallery' }} />
          <Tab.Screen name="Team" component={TeamScreen} options={{ title: 'Team' }} />
          <Tab.Screen name="Contact" component={ContactScreen} options={{ title: 'Contact' }} />
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
  deviceLabelText: {
    color: '#cfd5e3',
    fontSize: 12,
    fontWeight: '700'
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
    backgroundColor: '#150b31',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0
  },
  introBackdrop: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  introBackdropImage: {
    opacity: 0.34
  },
  introBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27, 10, 58, 0.62)'
  },
  introGlowTop: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 92, 195, 0.22)'
  },
  introGlowBottom: {
    position: 'absolute',
    bottom: -110,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(52, 214, 255, 0.2)'
  },
  introCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: 'rgba(44, 20, 90, 0.9)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
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
    color: '#ffe08d',
    fontSize: 14,
    fontWeight: '700'
  },
  welcomeTitle: {
    marginTop: 14,
    color: '#ffe59a',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24
  },
  welcomeBody: {
    marginTop: 10,
    color: '#f4eeff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21
  },
  welcomeFootnote: {
    marginTop: 12,
    color: '#d9cbff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center'
  },
  enterButton: {
    marginTop: 18,
    backgroundColor: '#ffd86c',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999
  },
  enterButtonAlt: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f0e5ff'
  },
  enterButtonText: {
    color: '#341064',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.4
  },
  enterButtonTextAlt: {
    color: '#4d1e9a'
  },
  headerBadge: {
    minWidth: 58,
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e9ddff',
    backgroundColor: '#f7f0ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  headerBadgeText: {
    color: '#5a31b3',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  tabIconBubble: {
    width: 34,
    height: 26,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabIconBubbleFocused: {
    backgroundColor: '#f0e7ff'
  }
});
