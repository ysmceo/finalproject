import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL, WEB_BASE_URL, buildApiUrl } from '../config';
import { applyHapticPreset, HapticPreset, triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../lib/haptics';
import { themeStorageKeys, ThemeMode, useThemePrefs } from '../theme';

const LAST_BOOKING_ID_KEY = 'ceosalon:lastBookingId';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';
const NOTIFICATIONS_ENABLED_KEY = 'ceosalon:notificationsEnabled';
export const ADMIN_TOKEN_KEY = 'ceosalon:adminToken';
export const ADMIN_EMAIL_KEY = 'ceosalon:adminEmail';

type Page = 'root' | 'notifications' | 'appearance' | 'privacy' | 'help' | 'about';

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={() => {
            triggerLightHaptic();
            onBack();
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed, pressed && styles.tapScale]}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </Pressable>
      ) : (
        <View style={styles.backBtnPlaceholder} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.backBtnPlaceholder} />
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const titleColor = danger ? '#d92d20' : '#111827';
  const baseStyle = [styles.row];

  const content = (
    <>
      <View style={[styles.iconWrap, danger && { backgroundColor: '#fef3f2' }]}>
        <Ionicons name={icon} size={18} color={danger ? '#d92d20' : '#5a31b3'} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>

      {right ? <View style={styles.rowRight}>{right}</View> : onPress ? <Ionicons name="chevron-forward" size={18} color="#ad9ad2" /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          triggerLightHaptic();
          onPress();
        }}
        style={({ pressed }) => [baseStyle, pressed && styles.rowPressed, pressed && styles.tapScale]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{content}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

async function openUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Cannot open link', url);
  }
}

export default function SettingsScreen() {
  const [page, setPage] = useState<Page>('root');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [apiTestBusy, setApiTestBusy] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<string>('');
  const [devHapticPreset, setDevHapticPreset] = useState<HapticPreset>('balanced');

  const { mode: themeMode, setMode: setThemeMode } = useThemePrefs();

  const appInfo = useMemo(() => {
    const cfg: any = (Constants as any).expoConfig || (Constants as any).manifest || {};
    const name = String(cfg?.name || 'CEO Salon');
    const version = String(cfg?.version || '');
    const sdk = String((Constants as any)?.expoConfig?.sdkVersion || (Constants as any)?.manifest?.sdkVersion || '');
    return { name, version, sdk };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        if (!active) return;
        if (stored === 'false') setNotificationsEnabled(false);
        if (stored === 'true') setNotificationsEnabled(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function persistNotifications(next: boolean) {
    setNotificationsEnabled(next);
    AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(next)).catch(() => undefined);
  }

  async function clearSavedBooking() {
    Alert.alert('Clear saved booking?', 'This clears the last Booking ID/Email saved on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([LAST_BOOKING_ID_KEY, LAST_BOOKING_EMAIL_KEY]);
            triggerWarningHaptic();
            Alert.alert('Done', 'Saved booking info cleared.');
          } catch {
            Alert.alert('Error', 'Failed to clear saved booking info.');
          }
        }
      }
    ]);
  }

  async function logout() {
    Alert.alert('Logout?', 'This will clear saved data on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const toRemove = keys.filter(k => String(k).startsWith('ceosalon:'));
            await AsyncStorage.multiRemove(toRemove);
            // Restore defaults in UI
            setNotificationsEnabled(true);
            setThemeMode('system');
            setPage('root');
            triggerWarningHaptic();
            Alert.alert('Logged out', 'Device data cleared.');
          } catch {
            Alert.alert('Error', 'Failed to logout/clear data.');
          }
        }
      }
    ]);
  }

  async function testApi() {
    setApiTestBusy(true);
    triggerMediumHaptic();
    setApiTestResult('');
    try {
      const url = buildApiUrl('/api/services');
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      setApiTestResult(res.ok ? '✅ API reachable.' : `⚠️ API error (HTTP ${res.status}).`);
    } catch (e) {
      setApiTestResult(`⚠️ ${e instanceof Error ? e.message : 'Failed to reach API'}`);
    } finally {
      setApiTestBusy(false);
    }
  }

  function cycleHapticPresetDevOnly() {
    if (!__DEV__) return;
    const presets: HapticPreset[] = ['subtle', 'balanced', 'strong'];
    const next = presets[(presets.indexOf(devHapticPreset) + 1) % presets.length];
    setDevHapticPreset(next);
    applyHapticPreset(next);
    triggerMediumHaptic();
    Alert.alert('Haptics preset', `Switched to ${next}.`);
  }

  if (page === 'notifications') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Header title="Notifications" onBack={() => setPage('root')} />

        <Card>
          <MenuRow
            icon="notifications-outline"
            title="Enable notifications"
            subtitle="Turn booking updates on/off"
            right={<Switch value={notificationsEnabled} onValueChange={persistNotifications} />}
          />
        </Card>

        <Text style={styles.note}>
          Note: This app currently shows updates inside the Track screen. Push notifications can be added later.
        </Text>
      </ScrollView>
    );
  }

  if (page === 'appearance') {
    const options: Array<{ label: string; value: ThemeMode; icon: keyof typeof Ionicons.glyphMap }> = [
      { label: 'System', value: 'system', icon: 'contrast-outline' },
      { label: 'Light', value: 'light', icon: 'sunny-outline' },
      { label: 'Dark', value: 'dark', icon: 'moon-outline' }
    ];

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Header title="Appearance" onBack={() => setPage('root')} />

        <Card>
          {options.map((opt, idx) => {
            const selected = themeMode === opt.value;
            return (
              <React.Fragment key={opt.value}>
                <MenuRow
                  icon={opt.icon}
                  title={opt.label}
                  subtitle={selected ? 'Selected' : undefined}
                  onPress={() => setThemeMode(opt.value)}
                  right={selected ? <Ionicons name="checkmark" size={20} color="#12b76a" /> : undefined}
                />
                {idx < options.length - 1 ? <Divider /> : null}
              </React.Fragment>
            );
          })}
        </Card>
      </ScrollView>
    );
  }

  if (page === 'privacy') {
    const localhostPattern = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i;
    const usingLocalhost = localhostPattern.test(WEB_BASE_URL) || localhostPattern.test(API_BASE_URL);

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Header title="Privacy & Security" onBack={() => setPage('root')} />

        <Card>
          <MenuRow
            icon="trash-outline"
            title="Clear saved booking"
            subtitle="Remove last Booking ID/Email stored on this device"
            onPress={clearSavedBooking}
          />
          <Divider />
          <MenuRow
            icon="shield-checkmark-outline"
            title="API test"
            subtitle={apiTestResult || buildApiUrl('/api/services')}
            onPress={() => {
              if (!apiTestBusy) testApi();
            }}
            right={<Text style={styles.actionText}>{apiTestBusy ? 'Testing…' : 'Test'}</Text>}
          />
        </Card>

        {Platform.OS !== 'web' && usingLocalhost ? (
          <Text style={styles.note}>
            Tip: Physical phones can’t reach your computer using localhost. Set EXPO_PUBLIC_WEB_BASE_URL / EXPO_PUBLIC_API_BASE_URL in {`mobile/.env`} to your LAN IP.
          </Text>
        ) : null}
      </ScrollView>
    );
  }

  if (page === 'help') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Header title="Help and Support" onBack={() => setPage('root')} />

        <Card>
          <MenuRow
            icon="globe-outline"
            title="Open website"
            subtitle={WEB_BASE_URL}
            onPress={() => openUrl(WEB_BASE_URL)}
          />
          <Divider />
          <MenuRow
            icon="call-outline"
            title="Contact"
            subtitle="Open the website contact section"
            onPress={() => openUrl(`${WEB_BASE_URL.replace(/\/+$/, '')}/#contact`)}
          />
          <Divider />
          <MenuRow
            icon="shield-outline"
            title="Admin"
            subtitle="Open Admin in browser"
            onPress={() => openUrl(`${WEB_BASE_URL.replace(/\/+$/, '')}/admin`)}
          />
        </Card>
      </ScrollView>
    );
  }

  if (page === 'about') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Header title="About" onBack={() => setPage('root')} />

        <Card>
          <MenuRow icon="information-circle-outline" title={appInfo.name} subtitle={appInfo.version ? `Version ${appInfo.version}` : undefined} />
          <Divider />
          <MenuRow icon="phone-portrait-outline" title="Platform" subtitle={Platform.OS} />
          {appInfo.sdk ? (
            <>
              <Divider />
              <MenuRow icon="rocket-outline" title="Expo SDK" subtitle={appInfo.sdk} />
            </>
          ) : null}
          <Divider />
          <MenuRow icon="link-outline" title="Website" subtitle={WEB_BASE_URL} onPress={() => openUrl(WEB_BASE_URL)} />
          <Divider />
          <MenuRow icon="server-outline" title="API" subtitle={API_BASE_URL} onPress={() => openUrl(buildApiUrl('/api/services'))} />
        </Card>

        <Text style={styles.note}>© {new Date().getFullYear()} CEO UNISEX SALON</Text>
      </ScrollView>
    );
  }

  // Root menu (matches the screenshot layout)
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Header title="Settings" />

      <Card>
        <MenuRow icon="notifications-outline" title="Notifications" onPress={() => setPage('notifications')} />
        <Divider />
        <MenuRow icon="color-palette-outline" title="Appearance" onPress={() => setPage('appearance')} />
        <Divider />
        <MenuRow icon="lock-closed-outline" title="Privacy & Security" onPress={() => setPage('privacy')} />
        <Divider />
        <MenuRow icon="help-circle-outline" title="Help and Support" onPress={() => setPage('help')} />
        <Divider />
        <MenuRow icon="information-circle-outline" title="About" onPress={() => setPage('about')} />
        <Divider />
        <MenuRow icon="log-out-outline" title="Logout" danger onPress={logout} />
      </Card>

      <Text style={styles.footerSmall}>Theme: {themeMode} • Notifications: {notificationsEnabled ? 'On' : 'Off'}</Text>
      <Pressable
        onLongPress={cycleHapticPresetDevOnly}
        delayLongPress={450}
        style={({ pressed }) => [pressed && styles.pressed, pressed && styles.tapScale]}
      >
        <Text style={styles.footerTiny}>
          Stored keys: {themeStorageKeys.THEME_MODE_KEY}, {NOTIFICATIONS_ENABLED_KEY}
          {__DEV__ ? ` • Haptics: ${devHapticPreset} (hold to switch)` : ''}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 34,
    backgroundColor: '#f6f8fc'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e2f6'
  },
  backBtnPlaceholder: {
    width: 40,
    height: 40
  },
  pressed: {
    opacity: 0.85
  },
  tapScale: {
    transform: [{ scale: 0.985 }]
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2d2342'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ece7f6',
    overflow: 'hidden',
    shadowColor: '#1f1238',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  rowPressed: {
    backgroundColor: '#f7f3ff'
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#f4edff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  rowSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#746a90'
  },
  rowRight: {
    marginLeft: 12,
    alignItems: 'flex-end'
  },
  divider: {
    height: 1,
    backgroundColor: '#f2edf9',
    marginLeft: 60
  },
  actionText: {
    color: '#7c46e8',
    fontWeight: '900'
  },
  note: {
    marginTop: 12,
    color: '#6b5f86',
    lineHeight: 18
  },
  footerSmall: {
    marginTop: 12,
    color: '#6b5f86',
    fontSize: 12
  },
  footerTiny: {
    marginTop: 6,
    color: '#a494c7',
    fontSize: 11
  }
});
