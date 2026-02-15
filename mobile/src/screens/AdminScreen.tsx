import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL, WEB_BASE_URL } from '../config';
import { ApiError, apiGetAuth, apiPostJson, apiPutJsonAuth } from '../lib/api';
import { ADMIN_EMAIL_KEY, ADMIN_TOKEN_KEY } from './SettingsScreen';

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
  // Expo Web: keep the existing web admin experience.
  if (Platform.OS === 'web') {
    const startUrl = `${normalizeUrl(WEB_BASE_URL)}/admin`;
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe title="CEO Salon Admin" src={startUrl} width="100%" height="100%" frameBorder="0" />
      </View>
    );
  }

  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretPasscode, setSecretPasscode] = useState('');

  const [busy, setBusy] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const isLoggedIn = Boolean(token);

  const adminWebsiteUrl = useMemo(() => {
    return `${normalizeUrl(WEB_BASE_URL)}/admin`;
  }, []);

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
  }

  async function login() {
    if (!email.trim() || !password.trim() || !secretPasscode.trim()) {
      Alert.alert('Missing info', 'Enter email, password, and secret passcode.');
      return;
    }

    setBusy(true);
    try {
      const res = await apiPostJson<AdminLoginResponse>('/api/admin/login', {
        email: email.trim(),
        password: password.trim(),
        secretPasscode: secretPasscode.trim()
      });

      await persistAuth(res.token, res.admin.email);
      Alert.alert('Admin login', 'Login successful.');
      await loadBookings(res.token);
    } catch (e) {
      if (e instanceof ApiError) {
        Alert.alert('Login failed', e.message);
      } else {
        Alert.alert('Login failed', e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadBookings(activeToken?: string) {
    const t = activeToken || token;
    if (!t) return;

    setLoadingBookings(true);
    try {
      const list = await apiGetAuth<any[]>('/api/admin/bookings', t);
      // Sort newest first if createdAt exists.
      const sorted = [...(Array.isArray(list) ? list : [])].sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
      setBookings(sorted);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert('Session expired', 'Please login again.');
        await clearAuth();
      } else {
        Alert.alert('Failed to load', e instanceof Error ? e.message : 'Could not load bookings');
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

  async function updateBookingStatus(bookingId: string, nextStatus: 'pending' | 'approved' | 'cancelled' | 'completed') {
    if (!token) return;

    setBusy(true);
    try {
      await apiPutJsonAuth<AdminUpdateBookingResponse>(`/api/admin/bookings/${bookingId}`, { status: nextStatus }, token);
      await loadBookings();
    } catch (e) {
      if (e instanceof ApiError) {
        Alert.alert('Update failed', e.message);
      } else {
        Alert.alert('Update failed', e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      setBusy(false);
    }
  }

  function promptBookingActions(b: any) {
    const id = String(b.id || '');
    if (!id) return;

    Alert.alert(
      'Booking actions',
      `${b.name || ''}\n${b.serviceName || ''}\nStatus: ${b.status || 'pending'}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Approve', onPress: () => updateBookingStatus(id, 'approved') },
        { text: 'Complete', onPress: () => updateBookingStatus(id, 'completed') },
        { text: 'Cancel', style: 'destructive', onPress: () => updateBookingStatus(id, 'cancelled') }
      ]
    );
  }

  useEffect(() => {
    if (token) {
      loadBookings().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.h1}>Admin</Text>
          <Pressable onPress={openAdminWebsite} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
            <Ionicons name="globe-outline" size={16} color="#b78a2a" />
            <Text style={styles.linkText}>Open web admin</Text>
          </Pressable>
        </View>

        <Text style={styles.sub}>Sign in to view and manage all bookings.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="admin@ceosaloon.com"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            style={styles.input}
          />

          <Text style={styles.label}>Secret passcode</Text>
          <TextInput
            value={secretPasscode}
            onChangeText={setSecretPasscode}
            secureTextEntry
            placeholder="Your admin secret passcode"
            style={styles.input}
          />

          <Pressable
            onPress={login}
            disabled={busy}
            style={({ pressed }) => [styles.primaryBtn, (busy || pressed) && styles.primaryBtnPressed]}
          >
            <Text style={styles.primaryBtnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>

          <Text style={styles.note}>
            Server: {normalizeUrl(API_BASE_URL)}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Bookings</Text>
          <Text style={styles.subSmall}>Signed in as {email || 'admin'}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={openAdminWebsite} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <Ionicons name="globe-outline" size={18} color="#344054" />
          </Pressable>
          <Pressable
            onPress={() => {
              Alert.alert('Logout?', 'This will sign you out of Admin on this device.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: () => clearAuth() }
              ]);
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Ionicons name="log-out-outline" size={18} color="#344054" />
          </Pressable>
        </View>
      </View>

      {loadingBookings && bookings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 10 }}>Loading bookings…</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ fontWeight: '700' }}>No bookings found.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = String(item.status || 'pending');
            const badgeStyle =
              status === 'approved'
                ? styles.badgeOk
                : status === 'cancelled'
                  ? styles.badgeBad
                  : status === 'completed'
                    ? styles.badgeDone
                    : styles.badgePending;

            return (
              <Pressable onPress={() => promptBookingActions(item)} style={({ pressed }) => [styles.bookingCard, pressed && styles.rowPressed]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.bookingTitle}>{item.serviceName || 'Service'}</Text>
                  <View style={[styles.badge, badgeStyle]}>
                    <Text style={styles.badgeText}>{status}</Text>
                  </View>
                </View>

                <Text style={styles.bookingSub}>{item.name} • {item.phone || ''}</Text>
                <Text style={styles.bookingSub}>{item.date || ''} {item.time || ''}</Text>
                <Text style={styles.bookingTiny}>ID: {String(item.id).slice(0, 10)}…</Text>
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
    flex: 1,
    backgroundColor: '#f6f7fb'
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  h1: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827'
  },
  sub: {
    paddingHorizontal: 16,
    marginBottom: 12,
    color: '#667085'
  },
  subSmall: {
    marginTop: 4,
    color: '#667085',
    fontSize: 12
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 18,
    padding: 14
  },
  label: {
    fontWeight: '800',
    color: '#344054',
    marginTop: 10
  },
  input: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#b78a2a',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryBtnPressed: {
    opacity: 0.85
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '900'
  },
  note: {
    marginTop: 12,
    color: '#98a2b3',
    fontSize: 11
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaecf0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999
  },
  linkText: {
    color: '#b78a2a',
    fontWeight: '900'
  },
  pressed: {
    opacity: 0.85
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaecf0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 16,
    padding: 14,
    marginTop: 12
  },
  bookingTitle: {
    fontWeight: '900',
    color: '#111827',
    flex: 1
  },
  bookingSub: {
    marginTop: 6,
    color: '#475467'
  },
  bookingTiny: {
    marginTop: 8,
    color: '#98a2b3',
    fontSize: 11
  },
  rowPressed: {
    backgroundColor: '#f9fafb'
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111827'
  },
  badgePending: {
    backgroundColor: '#f2f4f7'
  },
  badgeOk: {
    backgroundColor: '#ecfdf3'
  },
  badgeBad: {
    backgroundColor: '#fef3f2'
  },
  badgeDone: {
    backgroundColor: '#eff8ff'
  }
});
