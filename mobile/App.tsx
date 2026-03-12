import 'react-native-gesture-handler';

import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Animated, Image, ImageBackground, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import TeamScreen from './src/screens/TeamScreen';
import ContactScreen from './src/screens/ContactScreen';
import BookScreen from './src/screens/BookScreen';
import TrackScreen from './src/screens/TrackScreen';
import AdminScreen from './src/screens/AdminScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { applyHapticPreset, triggerLightHaptic } from './src/lib/haptics';
import { ThemeMode, ThemeProvider, useThemePrefs } from './src/theme';
import { getMobilePalette } from './src/ui/polish';

export type RootTabParamList = {
  Home: undefined;
  Book: { initialPath?: string } | undefined;
  Track: { initialPath?: string } | undefined;
  More: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Gallery: undefined;
  Team: undefined;
  Contact: undefined;
  Admin: { initialPath?: string } | undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const renderContent = () => (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );

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

  return renderContent();
}

function ThemeToggleButton() {
  const { mode, resolvedColorScheme, setMode } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  const nextMode: ThemeMode = isDark ? 'light' : 'dark';
  const iconName = isDark ? 'sunny-outline' : 'moon-outline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityHint="Long press to follow the system theme"
      onPress={() => {
        triggerLightHaptic();
        setMode(nextMode);
      }}
      onLongPress={() => {
        triggerLightHaptic();
        setMode('system');
      }}
      style={({ pressed }) => [
        styles.headerAction,
        { backgroundColor: palette.primarySoft, borderColor: palette.border },
        pressed && styles.headerActionPressed
      ]}
    >
      <Ionicons name={iconName} size={18} color={palette.primary} />
      {mode === 'system' ? <View style={[styles.systemDot, { backgroundColor: palette.secondary }]} /> : null}
    </Pressable>
  );
}

function HeaderActions() {
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');

  return (
    <View style={styles.headerActions}>
      <View style={[styles.headerBadge, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
        <Ionicons name="sparkles-outline" size={12} color={palette.warm} />
        <Text style={[styles.headerBadgeText, { color: palette.text }]}>CEO</Text>
      </View>
      <ThemeToggleButton />
    </View>
  );
}

function MobileWebScrollbarStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const doc = (globalThis as any).document;
    if (!doc?.head) return;

    const styleId = 'ceosalon-mobile-scrollbars';
    let styleEl = doc.getElementById?.(styleId);

    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = styleId;
      doc.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      * {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      *::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
    `;
  }, []);

  return null;
}

function MainTabs() {
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        animation: 'fade',
        sceneStyle: { backgroundColor: palette.bg },
        headerStyle: { backgroundColor: palette.card },
        headerTitleStyle: { fontWeight: '900', color: palette.text },
        headerShadowVisible: false,
        headerRight: () => <HeaderActions />,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          height: 66,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          backgroundColor: palette.card,
          shadowColor: '#0b1020',
          shadowOpacity: isDark ? 0.36 : 0.08,
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
              case 'Book':
                return focused ? 'calendar' : 'calendar-outline';
              case 'Track':
                return focused ? 'search' : 'search-outline';
              case 'More':
                return focused ? 'grid' : 'grid-outline';
              default:
                return 'ellipse-outline';
            }
          })();

          return (
            <View
              style={[
                styles.tabIconBubble,
                focused && {
                  backgroundColor: palette.primarySoft,
                  borderColor: palette.border
                }
              ]}
            >
              <Ionicons name={name} size={focused ? size + 1 : size} color={color} />
            </View>
          );
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Book" component={BookScreen} options={{ title: 'Book' }} />
      <Tab.Screen name="Track" component={TrackScreen} options={{ title: 'Track' }} />
      <Tab.Screen name="More" component={SettingsScreen} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}

function AppShell() {
  const { navigationTheme, resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');
  const [showIntro, setShowIntro] = useState(true);
  const [introStage, setIntroStage] = useState<'landing' | 'welcome'>('landing');
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.96)).current;
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const welcomeDurationMs = 4200;

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
  }, [introOpacity, introScale]);

  const enterAppNow = () => {
    if (welcomeTimerRef.current) {
      clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    }

    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true
    }).start(() => {
      setShowIntro(false);
    });
  };

  const handleEnter = () => {
    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true
    }).start(() => {
      setIntroStage('welcome');
      introOpacity.setValue(0);
      introScale.setValue(0.98);

      Animated.parallel([
        Animated.timing(introOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true
        }),
        Animated.timing(introScale, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true
        })
      ]).start();

      welcomeTimerRef.current = setTimeout(() => {
        enterAppNow();
      }, welcomeDurationMs);
    });
  };

  if (showIntro) {
    return (
      <>
        <MobileWebScrollbarStyles />
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
                    <Text style={styles.introSub}>Professional grooming for every schedule.</Text>
                    <Pressable style={styles.enterButton} onPress={handleEnter}>
                      <Text style={styles.enterButtonText}>Enter App</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.welcomeTitle}>Book, track, and manage every salon visit from one place.</Text>
                    <Text style={styles.welcomeBody}>
                      Clean design, reliable booking flow, and direct contact with the salon team.
                    </Text>
                    <Text style={styles.welcomeFootnote}>Preparing your premium salon experience...</Text>
                    <Pressable style={[styles.enterButton, styles.enterButtonAlt]} onPress={enterAppNow}>
                      <Text style={[styles.enterButtonText, styles.enterButtonTextAlt]}>Continue</Text>
                    </Pressable>
                  </>
                )}
              </Animated.View>
            </ImageBackground>
          </View>
        </SafeAreaProvider>
      </>
    );
  }

  return (
    <>
      <MobileWebScrollbarStyles />
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style={resolvedColorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack.Navigator
            screenOptions={{
              contentStyle: { backgroundColor: palette.bg },
              headerStyle: { backgroundColor: palette.card },
              headerTitleStyle: { fontWeight: '900', color: palette.text },
              headerTintColor: palette.text,
              headerShadowVisible: false,
              headerRight: () => <HeaderActions />
            }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Gallery" component={GalleryScreen} options={{ title: 'Gallery' }} />
            <Stack.Screen name="Team" component={TeamScreen} options={{ title: 'Team' }} />
            <Stack.Screen name="Contact" component={ContactScreen} options={{ title: 'Contact' }} />
            <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </>
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
    width: 390,
    maxWidth: '100%',
    height: 844,
    maxHeight: '92vh' as any,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 10,
    borderColor: '#1b1f29',
    backgroundColor: '#fff',
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
  introWrap: {
    flex: 1,
    backgroundColor: '#0b1020',
    alignItems: 'center',
    justifyContent: 'center'
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
    backgroundColor: 'rgba(8, 14, 28, 0.72)'
  },
  introGlowTop: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(84, 130, 255, 0.22)'
  },
  introGlowBottom: {
    position: 'absolute',
    bottom: -110,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(35, 212, 173, 0.16)'
  },
  introCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 24, 42, 0.9)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 22,
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
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 0.4
  },
  introSub: {
    marginTop: 12,
    color: '#d7e4ff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center'
  },
  welcomeTitle: {
    marginTop: 14,
    color: '#eef4ff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24
  },
  welcomeBody: {
    marginTop: 10,
    color: '#ced9ee',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21
  },
  welcomeFootnote: {
    marginTop: 12,
    color: '#9fb4e0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center'
  },
  enterButton: {
    marginTop: 18,
    backgroundColor: '#8ea8ff',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999
  },
  enterButtonAlt: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e1ee'
  },
  enterButtonText: {
    color: '#0b1020',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.4
  },
  enterButtonTextAlt: {
    color: '#2543a4'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerActionPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }]
  },
  systemDot: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 6,
    height: 6,
    borderRadius: 999
  },
  headerBadge: {
    minWidth: 58,
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  tabIconBubble: {
    width: 36,
    height: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
