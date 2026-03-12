import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { API_BASE_URL, WEB_BASE_URL } from '../config';
import { ApiError, apiGetAuth, apiPostJson, apiPutJsonAuth } from '../lib/api';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../lib/haptics';
import { ADMIN_EMAIL_KEY, ADMIN_TOKEN_KEY } from './SettingsScreen';
import { useThemePrefs } from '../theme';
import { getMobilePalette, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';

type AdminLoginResponse = {
  message: string;
  admin: { id: string; email: string; name: string };
  token: string;
};

type AdminUpdateBookingResponse = {
  message: string;
  booking: any;
};

function normalizeUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

export default function AdminScreen() {
  const navigation = useNavigation<any>();
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  if (Platform.OS === 'web') {
    const startUrl = `${normalizeUrl(WEB_BASE_URL)}/admin`;
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe title="CEO Salon Admin" src={startUrl} width="100%" height="100%" frameBorder="0" />
      </View>
    );
  }

  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretPasscode, setSecretPasscode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const isLoggedIn = Boolean(token);

  const adminWebsiteUrl = useMemo(() => `${normalizeUrl(WEB_BASE_URL)}/admin`, []);

  const themed = {
    wrap: { backgroundColor: palette.bg },
    hero: { backgroundColor: isDark ? '#172744' : '#2d477f', borderColor: isDark ? '#314b7e' : '#4b67a4' },
    card: { backgroundColor: palette.card, borderColor: palette.border },
    cardMuted: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    input: { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
    iconButton: { backgroundColor: palette.card, borderColor: palette.border },
    mutedText: { color: palette.textMuted },
    text: { color: palette.text }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [storedToken, storedEmail] = await Promise.all([
          AsyncStorage.getItem(ADMIN_TOKEN_KEY),
          AsyncStorage.getItem(ADMIN_EMAIL_KEY)
        ]);
        if (!active) return;
        if (storedToken) setToken(storedToken);
        if (storedEmail) setEmail(storedEmail);
      } catch {
        // ignore
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function openAdminWebsite() {
    try {
      await Linking.openURL(adminWebsiteUrl);
    } catch {
      Alert.alert('Cannot open', adminWebsiteUrl);
    }
  }

  async function persistAuth(nextToken: string, nextEmail: string) {
    setToken(nextToken);
    await AsyncStorage.multiSet([
      [ADMIN_TOKEN_KEY, nextToken],
      [ADMIN_EMAIL_KEY, nextEmail]
    ]);
  }

  async function clearAuth() {
    setToken('');
    await AsyncStorage.multiRemove([ADMIN_TOKEN_KEY, ADMIN_EMAIL_KEY]);
    triggerWarningHaptic();
  }

  async function login() {
    if (!email.trim() || !password.trim() || !secretPasscode.trim()) {
      Alert.alert('Missing info', 'Enter email, password, and secret passcode.');
      return;
    }

    setBusy(true);
    triggerMediumHaptic();
    try {
      const res = await apiPostJson<AdminLoginResponse>('/api/admin/login', {
        email: email.trim(),
        password: password.trim(),
        secretPasscode: secretPasscode.trim()
      });

      await persistAuth(res.token, res.admin.email);
      triggerSuccessHaptic();
      Alert.alert('Admin login', 'Login successful.');
      await loadBookings(res.token);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Login failed', message);
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordResetOtp() {
    if (!email.trim() || !secretPasscode.trim()) {
      Alert.alert('Missing info', 'Enter admin email and secret passcode first.');
      return;
    }

    setBusy(true);
    triggerMediumHaptic();
    try {
      await apiPostJson('/api/admin/request-login-access', {
        email: email.trim(),
        secretPasscode: secretPasscode.trim()
      });
      triggerSuccessHaptic();
      Alert.alert('OTP sent', 'Password reset OTP has been sent to your admin email.');
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Request failed', message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim() || !secretPasscode.trim() || !resetCode.trim() || !newPassword.trim()) {
      Alert.alert('Missing info', 'Enter email, secret passcode, reset OTP, and new password.');
      return;
    }

    if (newPassword.trim().length < 6) {
      Alert.alert('Invalid password', 'New password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    triggerMediumHaptic();
    try {
      await apiPostJson('/api/admin/reset-password', {
        email: email.trim(),
        oneTimeCode: String(resetCode || '').replace(/\D/g, '').trim(),
        newPassword: newPassword.trim(),
        secretPasscode: secretPasscode.trim()
      });

      setPassword(newPassword.trim());
      setResetCode('');
      setNewPassword('');
      setShowForgotPassword(false);
      triggerSuccessHaptic();
      Alert.alert('Password reset', 'Password reset successful. Use your new password to login.');
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Reset failed', message);
    } finally {
      setBusy(false);
    }
  }

  async function loadBookings(activeToken?: string) {
    const currentToken = activeToken || token;
    if (!currentToken) return;

    setLoadingBookings(true);
    try {
      const list = await apiGetAuth<any[]>('/api/admin/bookings', currentToken);
      const sorted = [...(Array.isArray(list) ? list : [])].sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
      setBookings(sorted);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        Alert.alert('Session expired', 'Please login again.');
        await clearAuth();
      } else {
        Alert.alert('Failed to load', error instanceof Error ? error.message : 'Could not load bookings');
      }
    } finally {
      setLoadingBookings(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await loadBookings();
    } finally {
      setRefreshing(false);
    }
  }

  async function updateBookingStatus(
    bookingId: string,
    nextStatus: 'pending' | 'approved' | 'cancelled' | 'completed'
  ) {
    if (!token) return;

    setBusy(true);
    triggerMediumHaptic();
    try {
      await apiPutJsonAuth<AdminUpdateBookingResponse>(`/api/admin/bookings/${bookingId}`, { status: nextStatus }, token);
      if (nextStatus === 'cancelled') {
        triggerWarningHaptic();
      } else {
        triggerSuccessHaptic();
      }
      await loadBookings();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Update failed', message);
    } finally {
      setBusy(false);
    }
  }

  function promptBookingActions(booking: any) {
    const id = String(booking.id || '');
    if (!id) return;

    Alert.alert(
      'Booking actions',
      `${booking.name || ''}\n${booking.serviceName || ''}\nStatus: ${booking.status || 'pending'}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Approve', onPress: () => updateBookingStatus(id, 'approved') },
        { text: 'Complete', onPress: () => updateBookingStatus(id, 'completed') },
        { text: 'Cancel', style: 'destructive', onPress: () => updateBookingStatus(id, 'cancelled') }
      ]
    );
  }

  function getStatusTone(status: string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved') {
      return {
        backgroundColor: isDark ? '#173224' : '#e8f8ef',
        borderColor: isDark ? '#2d6b49' : '#b6dfc5',
        color: isDark ? '#97e3b4' : '#0f6b3d'
      };
    }
    if (normalized === 'cancelled') {
      return {
        backgroundColor: isDark ? '#341921' : '#fff0ef',
        borderColor: isDark ? '#6a3442' : '#efc1bf',
        color: isDark ? '#ffb6b6' : '#ad2f2f'
      };
    }
    if (normalized === 'completed') {
      return {
        backgroundColor: isDark ? '#1d2947' : '#ecf3ff',
        borderColor: isDark ? '#355080' : '#bfd1f0',
        color: isDark ? '#bdd3ff' : '#214f9a'
      };
    }
    return {
      backgroundColor: isDark ? '#392d1f' : '#fff5df',
      borderColor: isDark ? '#6b5438' : '#e9cf98',
      color: isDark ? '#ffd38a' : '#94610a'
    };
  }

  useEffect(() => {
    if (token) {
      loadBookings().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={[styles.wrap, themed.wrap]}>
        <KeyboardAvoidingView
          style={styles.authKeyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.authScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.heroCard, themed.hero]}>
              <View style={styles.heroGlowOne} />
              <View style={styles.heroGlowTwo} />
              <Text style={styles.heroKicker}>ADMIN</Text>
              <Text style={styles.heroTitle}>Secure sign-in for bookings and operational updates.</Text>
              <Text style={styles.heroSubtitle}>Use the same backend credentials you configured for the web admin.</Text>
            </View>

            <View style={styles.quickAccessRow}>
              <Pressable
                onPress={() => {
                  triggerLightHaptic();
                  navigation.navigate('Track');
                }}
                style={({ pressed }) => [
                  styles.quickAction,
                  themed.card,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons name="search-outline" size={18} color={palette.primary} />
                <Text style={[styles.quickActionText, themed.text]}>Track</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  triggerLightHaptic();
                  navigation.navigate('More');
                }}
                style={({ pressed }) => [
                  styles.quickAction,
                  themed.card,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons name="grid-outline" size={18} color={palette.primary} />
                <Text style={[styles.quickActionText, themed.text]}>More</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  triggerLightHaptic();
                  openAdminWebsite();
                }}
                style={({ pressed }) => [
                  styles.quickAction,
                  themed.card,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons name="globe-outline" size={18} color={palette.primary} />
                <Text style={[styles.quickActionText, themed.text]}>Web admin</Text>
              </Pressable>
            </View>

            <View style={[styles.card, themed.card]}>
              <Text style={[styles.label, themed.text]}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="admin@ceosaloon.com"
                placeholderTextColor={palette.textMuted}
                style={[styles.input, themed.input]}
              />

              <Text style={[styles.label, themed.text]}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter password"
                placeholderTextColor={palette.textMuted}
                style={[styles.input, themed.input]}
              />

              <Text style={[styles.label, themed.text]}>Secret passcode</Text>
              <TextInput
                value={secretPasscode}
                onChangeText={setSecretPasscode}
                secureTextEntry
                placeholder="Enter admin secret passcode"
                placeholderTextColor={palette.textMuted}
                style={[styles.input, themed.input]}
              />

              <Pressable
                onPress={() => {
                  triggerLightHaptic();
                  login();
                }}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: palette.primary },
                  (busy || pressed) && styles.primaryBtnPressed
                ]}
              >
                <Text style={styles.primaryBtnText}>{busy ? 'Signing in...' : 'Sign in'}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  triggerLightHaptic();
                  setShowForgotPassword((prev) => !prev);
                }}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  themed.cardMuted,
                  pressed && styles.primaryBtnPressed
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: palette.text }]}>
                  {showForgotPassword ? 'Hide password reset' : 'Forgot password? Reset with OTP'}
                </Text>
                <Ionicons
                  name={showForgotPassword ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={palette.textMuted}
                />
              </Pressable>

              {showForgotPassword ? (
                <View style={styles.forgotPanel}>
                  <Pressable
                    onPress={() => {
                      triggerLightHaptic();
                      requestPasswordResetOtp();
                    }}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.secondaryBlockButton,
                      themed.cardMuted,
                      pressed && styles.primaryBtnPressed
                    ]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Send password reset OTP</Text>
                  </Pressable>

                  <Text style={[styles.label, themed.text]}>Reset OTP code</Text>
                  <TextInput
                    value={resetCode}
                    onChangeText={setResetCode}
                    keyboardType="number-pad"
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={palette.textMuted}
                    style={[styles.input, themed.input]}
                  />

                  <Text style={[styles.label, themed.text]}>New password</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholder="Enter new password"
                    placeholderTextColor={palette.textMuted}
                    style={[styles.input, themed.input]}
                  />

                  <Pressable
                    onPress={() => {
                      triggerLightHaptic();
                      resetPassword();
                    }}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.secondaryBlockButton,
                      themed.cardMuted,
                      pressed && styles.primaryBtnPressed
                    ]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Reset password</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={[styles.note, themed.mutedText]}>Backend: {normalizeUrl(API_BASE_URL)}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.wrap, themed.wrap]}>
      <View style={styles.listHeaderWrap}>
        <View style={[styles.heroCompact, themed.hero]}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <Text style={styles.heroKicker}>ADMIN</Text>
          <Text style={styles.heroTitle}>Bookings overview</Text>
          <Text style={styles.heroSubtitle}>Signed in as {email || 'admin'}</Text>
        </View>

        <View style={styles.quickAccessRow}>
          <Pressable
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('Track');
            }}
            style={({ pressed }) => [styles.quickAction, themed.card, pressed && styles.pressed]}
          >
            <Ionicons name="search-outline" size={18} color={palette.primary} />
            <Text style={[styles.quickActionText, themed.text]}>Track</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              triggerLightHaptic();
              openAdminWebsite();
            }}
            style={({ pressed }) => [styles.quickAction, themed.card, pressed && styles.pressed]}
          >
            <Ionicons name="globe-outline" size={18} color={palette.primary} />
            <Text style={[styles.quickActionText, themed.text]}>Web admin</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              triggerLightHaptic();
              Alert.alert('Logout?', 'This will sign you out of Admin on this device.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: () => {
                    clearAuth();
                  }
                }
              ]);
            }}
            style={({ pressed }) => [styles.quickAction, themed.card, pressed && styles.pressed]}
          >
            <Ionicons name="log-out-outline" size={18} color={palette.danger} />
            <Text style={[styles.quickActionText, { color: palette.danger }]}>Logout</Text>
          </Pressable>
        </View>
      </View>

      {loadingBookings && bookings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.centerText, themed.mutedText]}>Loading bookings...</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<View style={{ height: 4 }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, themed.text]}>No bookings found.</Text>
              <Text style={[styles.centerText, themed.mutedText]}>New bookings will appear here after customers submit them.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const tone = getStatusTone(String(item.status || 'pending'));
            return (
              <Pressable
                onPress={() => {
                  triggerLightHaptic();
                  promptBookingActions(item);
                }}
                style={({ pressed }) => [
                  styles.bookingCard,
                  themed.card,
                  pressed && styles.pressed
                ]}
              >
                <View style={styles.bookingTopRow}>
                  <Text style={[styles.bookingTitle, themed.text]}>{item.serviceName || 'Service'}</Text>
                  <View style={[styles.badge, tone]}>
                    <Text style={[styles.badgeText, { color: tone.color }]}>{String(item.status || 'pending')}</Text>
                  </View>
                </View>

                <Text style={[styles.bookingSub, themed.text]}>{item.name} - {item.phone || 'No phone'}</Text>
                <Text style={[styles.bookingMeta, themed.mutedText]}>{item.date || ''} {item.time || ''}</Text>
                <Text style={[styles.bookingMeta, themed.mutedText]}>ID: {String(item.id).slice(0, 12)}...</Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1
  },
  authKeyboardWrap: {
    flex: 1
  },
  authScrollContent: {
    padding: MOBILE_SPACE.xxl,
    paddingBottom: 28
  },
  heroCard: {
    borderRadius: MOBILE_SHAPE.cardRadius,
    borderWidth: 1,
    padding: MOBILE_SPACE.xxl,
    overflow: 'hidden'
  },
  heroCompact: {
    borderRadius: MOBILE_SHAPE.cardRadius,
    borderWidth: 1,
    padding: MOBILE_SPACE.xl,
    overflow: 'hidden'
  },
  heroGlowOne: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 999,
    top: -54,
    right: -30,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 999,
    bottom: -85,
    left: -50,
    backgroundColor: 'rgba(125, 198, 255, 0.14)'
  },
  heroKicker: {
    color: '#d9e5ff',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: MOBILE_TYPE.caption,
    marginBottom: 6
  },
  heroTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: MOBILE_TYPE.title,
    lineHeight: 30
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#d7e4ff',
    fontSize: MOBILE_TYPE.body,
    lineHeight: 20
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: MOBILE_SPACE.lg
  },
  quickAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  quickActionText: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  },
  card: {
    marginTop: MOBILE_SPACE.lg,
    borderRadius: MOBILE_SHAPE.cardRadius,
    borderWidth: 1,
    padding: MOBILE_SPACE.lg,
    shadowColor: '#09111f',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: MOBILE_TYPE.body,
    fontWeight: '800'
  },
  input: {
    borderWidth: 1,
    borderRadius: MOBILE_SHAPE.inputRadius,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: MOBILE_TYPE.body
  },
  primaryBtn: {
    marginTop: 16,
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: 13,
    alignItems: 'center'
  },
  primaryBtnPressed: {
    opacity: 0.88
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: MOBILE_TYPE.body
  },
  secondaryBtn: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  secondaryBlockButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBtnText: {
    fontWeight: '800',
    fontSize: MOBILE_TYPE.caption
  },
  forgotPanel: {
    marginTop: 10
  },
  note: {
    marginTop: 14,
    fontSize: MOBILE_TYPE.caption
  },
  listHeaderWrap: {
    paddingHorizontal: MOBILE_SPACE.xxl,
    paddingTop: MOBILE_SPACE.lg
  },
  listContent: {
    paddingHorizontal: MOBILE_SPACE.xxl,
    paddingBottom: 28
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  centerText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: MOBILE_TYPE.body
  },
  emptyTitle: {
    fontWeight: '900',
    fontSize: MOBILE_TYPE.heading
  },
  bookingCard: {
    borderRadius: MOBILE_SHAPE.cardRadius,
    borderWidth: 1,
    padding: MOBILE_SPACE.lg,
    marginTop: 12,
    shadowColor: '#09111f',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2
  },
  bookingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  bookingTitle: {
    flex: 1,
    fontWeight: '900',
    fontSize: MOBILE_TYPE.body
  },
  bookingSub: {
    marginTop: 8,
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700'
  },
  bookingMeta: {
    marginTop: 5,
    fontSize: MOBILE_TYPE.caption
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeText: {
    fontSize: MOBILE_TYPE.micro,
    fontWeight: '900'
  },
  pressed: {
    opacity: 0.9
  }
});
