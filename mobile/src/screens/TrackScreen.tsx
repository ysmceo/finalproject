import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';

import { apiGet, ApiError } from '../lib/api';
import { buildApiUrl } from '../config';
import type { ProductOrderTrackResponse, TrackResponse } from '../types';

const LAST_TRACKING_CODE_KEY = 'ceosalon:lastTrackingCode';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';
const LAST_PRODUCT_ORDER_CODE_KEY = 'ceosalon:lastProductOrderCode';
const LAST_PRODUCT_ORDER_EMAIL_KEY = 'ceosalon:lastProductOrderEmail';

type BankDetails = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  amountDueNow: number;
  bookingId: string;
};

function MicroPress({
  onPress,
  style,
  children,
  disabled
}: {
  onPress: () => void;
  style: any;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  };

  return (
    <Pressable
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function StaggerReveal({
  index,
  children
}: {
  index: number;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const delay = Math.min(index * 60, 420);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [index, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function TrackScreen(props: any) {
  const initialTrackingCode = String(props?.route?.params?.trackingCode || props?.route?.params?.bookingId || '');
  const initialEmail = String(props?.route?.params?.email || '');
  const initialOrderCode = String(props?.route?.params?.orderCode || '');
  const initialOrderEmail = String(props?.route?.params?.orderEmail || props?.route?.params?.email || '');

  const [trackingCode, setTrackingCode] = useState(initialTrackingCode);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrackResponse | null>(null);
  const [orderCode, setOrderCode] = useState(initialOrderCode);
  const [orderEmail, setOrderEmail] = useState(initialOrderEmail);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderData, setOrderData] = useState<ProductOrderTrackResponse | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const screenEntry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenEntry, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [screenEntry]);

  useEffect(() => {
    // If params are empty, try to load last booking from storage.
    (async () => {
      const [lastId, lastEmail, lastOrderCode, lastOrderEmail] = await Promise.all([
        AsyncStorage.getItem(LAST_TRACKING_CODE_KEY),
        AsyncStorage.getItem(LAST_BOOKING_EMAIL_KEY),
        AsyncStorage.getItem(LAST_PRODUCT_ORDER_CODE_KEY),
        AsyncStorage.getItem(LAST_PRODUCT_ORDER_EMAIL_KEY)
      ]);
      if (!trackingCode && lastId) setTrackingCode(lastId);
      if (!email && lastEmail) setEmail(lastEmail);
      if (!orderCode && lastOrderCode) setOrderCode(lastOrderCode);
      if (!orderEmail && lastOrderEmail) setOrderEmail(lastOrderEmail);
    })().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canFetch = useMemo(() => {
    return Boolean(trackingCode.trim() && email.trim());
  }, [trackingCode, email]);

  const canFetchOrder = useMemo(() => {
    return Boolean(orderCode.trim() && orderEmail.trim());
  }, [orderCode, orderEmail]);

  const cardIn = (offset: number) => ({
    opacity: screenEntry,
    transform: [
      {
        translateY: screenEntry.interpolate({
          inputRange: [0, 1],
          outputRange: [offset, 0]
        })
      }
    ]
  });

  function getBookingStatusMeta(status: string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved' || normalized === 'accepted') {
      return { label: '✅ Approved', bg: '#e8f8ec', color: '#126d32', border: '#9ddfb2' };
    }
    if (normalized === 'cancelled' || normalized === 'rejected' || normalized === 'declined') {
      return { label: '❌ Rejected', bg: '#ffe9e9', color: '#9d1c1c', border: '#f2b0b0' };
    }
    if (normalized === 'completed') {
      return { label: '🎉 Completed', bg: '#e9f3ff', color: '#134f8f', border: '#aac8ee' };
    }
    return { label: '⏳ Pending', bg: '#fff5df', color: '#8a5a00', border: '#f0d2a0' };
  }

  function formatProductOrderStatus(status: string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved') return '✅ Approved';
    if (normalized === 'cancelled') return '❌ Cancelled';
    if (normalized === 'completed') return '🎉 Completed';
    return '⏳ Pending';
  }

  async function fetchTracking() {
    if (!canFetch) {
      Alert.alert('Missing info', 'Enter your Tracking Code and Email.');
      return;
    }
    setLoading(true);
    setData(null);
    setBankDetails(null);
    try {
      const res = await apiGet<TrackResponse>(`/api/bookings/track?trackingCode=${encodeURIComponent(trackingCode.trim())}&email=${encodeURIComponent(email.trim())}`);
      setData(res);
      await AsyncStorage.setItem(LAST_TRACKING_CODE_KEY, String(res.booking.trackingCode || trackingCode.trim()).toUpperCase());
      await AsyncStorage.setItem(LAST_BOOKING_EMAIL_KEY, email.trim());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : 'Failed to fetch booking');
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBankDetails() {
    if (!canFetch || !data || !data.booking || !data.booking.id) return;
    try {
      const details = await apiGet<BankDetails>(`/api/payments/bank/details?bookingId=${encodeURIComponent(data.booking.id)}&email=${encodeURIComponent(email.trim())}`);
      setBankDetails(details);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load bank details');
    }
  }

  async function fetchProductTracking() {
    if (!canFetchOrder) {
      Alert.alert('Missing info', 'Enter your Product Order Code and Email.');
      return;
    }

    setOrderLoading(true);
    setOrderData(null);
    try {
      const res = await apiGet<ProductOrderTrackResponse>(`/api/product-orders/track?orderCode=${encodeURIComponent(orderCode.trim())}&email=${encodeURIComponent(orderEmail.trim())}`);
      setOrderData(res);
      await AsyncStorage.setItem(LAST_PRODUCT_ORDER_CODE_KEY, String(res.order.orderCode || orderCode.trim()).toUpperCase());
      await AsyncStorage.setItem(LAST_PRODUCT_ORDER_EMAIL_KEY, orderEmail.trim().toLowerCase());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : 'Failed to fetch product order');
      Alert.alert('Error', message);
    } finally {
      setOrderLoading(false);
    }
  }

  async function uploadReceipt() {
    if (!canFetch) {
      Alert.alert('Missing info', 'Enter your Tracking Code and Email first.');
      return;
    }

    const resolvedBookingId = String(data && data.booking && data.booking.id ? data.booking.id : '').trim();
    if (!resolvedBookingId) {
      Alert.alert('Track first', 'Please load your booking details before uploading receipt.');
      return;
    }

    try {
      setUploadingReceipt(true);
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: false,
        copyToCacheDirectory: true
      });

      if (picked.canceled) return;
      const file = picked.assets && picked.assets[0] ? picked.assets[0] : null;
      if (!file?.uri) {
        Alert.alert('Error', 'No file selected.');
        return;
      }

      const form = new FormData();
      form.append('email', email.trim());
      form.append('receipt', {
        uri: file.uri,
        name: file.name || 'receipt',
        type: (file.mimeType as string) || 'application/octet-stream'
      } as any);

      const res = await fetch(buildApiUrl(`/api/bookings/${encodeURIComponent(resolvedBookingId)}/upload-receipt`), {
        method: 'POST',
        body: form
      });

      const payloadText = await res.text().catch(() => '');
      const payload = payloadText ? (() => {
        try {
          return JSON.parse(payloadText);
        } catch {
          return payloadText;
        }
      })() : null;

      if (!res.ok) {
        const msg = payload && typeof payload === 'object' && 'error' in payload ? String((payload as any).error) : `Upload failed (${res.status})`;
        throw new Error(msg);
      }

      Alert.alert('Uploaded', 'Receipt uploaded successfully.');
      // Refresh tracking to show receipt status + new notifications.
      await fetchTracking();
    } catch (error) {
      Alert.alert('Upload error', error instanceof Error ? error.message : 'Failed to upload receipt');
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function pasteTrackingCodeFromClipboard() {
    const value = await Clipboard.getStringAsync();
    if (value) {
      setTrackingCode(value.trim().toUpperCase());
    }
  }

  async function copyTrackingCodeToClipboard() {
    const code = String(data?.booking?.trackingCode || '').trim();
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Tracking code copied to clipboard.');
  }

  async function useSavedBookingDetails() {
    const [savedCode, savedEmail] = await Promise.all([
      AsyncStorage.getItem(LAST_TRACKING_CODE_KEY),
      AsyncStorage.getItem(LAST_BOOKING_EMAIL_KEY)
    ]);

    if (!savedCode || !savedEmail) {
      Alert.alert('No saved booking', 'Create or track a booking first to save details.');
      return;
    }

    setTrackingCode(savedCode);
    setEmail(savedEmail);
    Alert.alert('Loaded', 'Saved booking tracking details loaded.');
  }

  async function useSavedOrderDetails() {
    const [savedCode, savedEmail] = await Promise.all([
      AsyncStorage.getItem(LAST_PRODUCT_ORDER_CODE_KEY),
      AsyncStorage.getItem(LAST_PRODUCT_ORDER_EMAIL_KEY)
    ]);

    if (!savedCode || !savedEmail) {
      Alert.alert('No saved order', 'Track a product order first to save details.');
      return;
    }

    setOrderCode(savedCode);
    setOrderEmail(savedEmail);
    Alert.alert('Loaded', 'Saved product order details loaded.');
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.heroCard, cardIn(20)]}>
        <Text style={styles.heroKicker}>LIVE UPDATES</Text>
        <Text style={styles.h1}>Track your booking</Text>
        <Text style={styles.sub}>Follow booking and product order status in real time.</Text>
      </Animated.View>

      <Animated.View style={[styles.card, cardIn(28)]}>
        <Text style={styles.cardTitle}>Booking Tracker</Text>
        <Text style={styles.label}>Tracking Code</Text>
        <TextInput style={styles.input} value={trackingCode} onChangeText={setTrackingCode} placeholder="e.g. BOOK-ABC12345" autoCapitalize="characters" />
        <View style={styles.rowWrap}>
          <MicroPress style={styles.buttonSmallAlt} onPress={pasteTrackingCodeFromClipboard}>
            <Text style={styles.buttonSmallAltText}>Paste code</Text>
          </MicroPress>
        </View>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
        <View style={styles.rowWrap}>
          <MicroPress style={styles.buttonSmallAlt} onPress={useSavedBookingDetails}>
            <Text style={styles.buttonSmallAltText}>Use saved booking</Text>
          </MicroPress>
        </View>

        <MicroPress style={[styles.button, (!canFetch || loading) && styles.buttonDisabled]} onPress={fetchTracking} disabled={!canFetch || loading}>
          <Text style={styles.buttonText}>{loading ? 'Loading…' : 'Track booking'}</Text>
        </MicroPress>
      </Animated.View>

      <Animated.View style={[styles.card, cardIn(34)]}>
        <Text style={styles.cardTitle}>Product Order Tracker</Text>
        <Text style={styles.h2}>Track your product order</Text>
        <Text style={styles.label}>Product Order Code</Text>
        <TextInput style={styles.input} value={orderCode} onChangeText={setOrderCode} placeholder="e.g. ORD-MA4N7X2" autoCapitalize="characters" />
        <Text style={styles.label}>Order Email</Text>
        <TextInput style={styles.input} value={orderEmail} onChangeText={setOrderEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
        <View style={styles.rowWrap}>
          <MicroPress style={styles.buttonSmallAlt} onPress={useSavedOrderDetails}>
            <Text style={styles.buttonSmallAltText}>Use saved order</Text>
          </MicroPress>
        </View>

        <MicroPress style={[styles.button, (!canFetchOrder || orderLoading) && styles.buttonDisabled]} onPress={fetchProductTracking} disabled={!canFetchOrder || orderLoading}>
          <Text style={styles.buttonText}>{orderLoading ? 'Loading…' : 'Track product order'}</Text>
        </MicroPress>
      </Animated.View>

      {data ? (
        <Animated.View style={[styles.card, cardIn(40)]}>
          <Text style={styles.h2}>Booking</Text>
          <View style={styles.statusRow}>
            <Text style={styles.kvLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: getBookingStatusMeta(data.booking.status).bg,
                  borderColor: getBookingStatusMeta(data.booking.status).border
                }
              ]}
            >
              <Text style={[styles.statusText, { color: getBookingStatusMeta(data.booking.status).color }]}>
                {getBookingStatusMeta(data.booking.status).label}
              </Text>
            </View>
          </View>
          <Text style={styles.kvValue}>Tracking Code: {String(data.booking.trackingCode || '').trim() || 'N/A'}</Text>
          <View style={styles.rowWrap}>
            <MicroPress style={styles.buttonSmallAlt} onPress={copyTrackingCodeToClipboard}>
              <Text style={styles.buttonSmallAltText}>Copy tracking code</Text>
            </MicroPress>
          </View>
          <Text style={styles.kvValue}>Service: {data.booking.serviceName}</Text>
          <Text style={styles.kvValue}>Date/Time: {data.booking.date} • {data.booking.time}</Text>
          <Text style={styles.kvValue}>Payment: {data.booking.paymentStatus} ({data.booking.paymentPlan})</Text>
          <Text style={styles.kvValue}>Due now: ₦{Number(data.booking.amountDueNow || 0).toLocaleString()}</Text>
          <Text style={styles.kvValue}>Remaining: ₦{Number(data.booking.amountRemaining || 0).toLocaleString()}</Text>
          {data.booking.serviceMode === 'home' ? (
            <Text style={styles.kvValue}>Home address: {data.booking.homeServiceAddress}</Text>
          ) : null}

          {String(data.booking.paymentMethod || '').trim() === 'Bank Transfer' ? (
            <>
              <View style={styles.rowWrap}>
                <MicroPress style={styles.buttonSmall} onPress={fetchBankDetails}>
                  <Text style={styles.buttonText}>Bank details</Text>
                </MicroPress>
                <MicroPress
                  style={[styles.buttonSmall, uploadingReceipt && styles.buttonDisabled]}
                  onPress={uploadReceipt}
                  disabled={uploadingReceipt}
                >
                  <Text style={styles.buttonText}>{uploadingReceipt ? 'Uploading…' : 'Upload receipt'}</Text>
                </MicroPress>
              </View>

              {bankDetails ? (
                <View style={styles.cardInner}>
                  <Text style={styles.h3}>Bank Transfer Details</Text>
                  <Text style={styles.kvValue}>{bankDetails.bankName}</Text>
                  <Text style={styles.kvValue}>{bankDetails.accountNumber}</Text>
                  <Text style={styles.kvValue}>{bankDetails.accountName}</Text>
                  <Text style={styles.kvValue}>Reference: {bankDetails.reference}</Text>
                  <Text style={styles.kvValue}>Amount due now: ₦{Number(bankDetails.amountDueNow || 0).toLocaleString()}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </Animated.View>
      ) : null}

      {orderData ? (
        <Animated.View style={[styles.card, cardIn(48)]}>
          <Text style={styles.h2}>Product Order</Text>
          <View style={styles.statusRow}>
            <Text style={styles.kvLabel}>Status</Text>
            <View style={[styles.statusBadge, styles.statusBadgeInfo]}>
              <Text style={[styles.statusText, styles.statusTextInfo]}>{formatProductOrderStatus(orderData.order.status)}</Text>
            </View>
          </View>
          <Text style={styles.kvValue}>Order Code: {String(orderData.order.orderCode || '').trim() || 'N/A'}</Text>
          <Text style={styles.kvValue}>Payment: {orderData.order.paymentStatus} ({orderData.order.paymentMethod})</Text>
          <Text style={styles.kvValue}>Total: ₦{Number(orderData.order.totalAmount || 0).toLocaleString()}</Text>
          <Text style={styles.kvValue}>Due now: ₦{Number(orderData.order.amountDueNow || 0).toLocaleString()}</Text>
          <Text style={styles.kvValue}>Remaining: ₦{Number(orderData.order.amountRemaining || 0).toLocaleString()}</Text>
          <Text style={[styles.h3, { marginTop: 10 }]}>Items</Text>
          {(orderData.order.items || []).map((item, index) => (
            <StaggerReveal key={`${item.productId}-${index}`} index={index}>
              <Text style={styles.kvValue}>
                • {item.name} × {item.quantity} — ₦{Number(item.lineTotal || 0).toLocaleString()}
              </Text>
            </StaggerReveal>
          ))}
        </Animated.View>
      ) : null}

      {data ? (
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.h2}>Notifications</Text>
          <FlatList
            data={data.notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 10, gap: 10 }}
            renderItem={({ item, index }) => (
              <StaggerReveal index={index}>
                <View style={styles.note}>
                  <Text style={styles.noteMsg}>{item.message}</Text>
                  <Text style={styles.noteMeta}>{new Date(item.createdAt).toLocaleString()}</Text>
                </View>
              </StaggerReveal>
            )}
            ListEmptyComponent={<Text style={styles.sub}>No notifications yet.</Text>}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f6f8fc'
  },
  h1: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff'
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f4d98a',
    letterSpacing: 1,
    marginBottom: 6
  },
  h2: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2d2342'
  },
  h3: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3b2a5e'
  },
  sub: {
    marginTop: 6,
    color: '#e9dfff'
  },
  heroCard: {
    backgroundColor: '#2f1d63',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#5f35af',
    shadowColor: '#220a4c',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8b5a11',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  card: {
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ece7f6',
    shadowColor: '#160a2a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3
  },
  cardInner: {
    marginTop: 12,
    backgroundColor: '#fff8e9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f3dfb1'
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '700',
    color: '#3b2f54'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d2e8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff'
  },
  rowWrap: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center'
  },
  button: {
    marginTop: 14,
    backgroundColor: '#7c46e8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#4f22a8',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3
  },
  buttonSmall: {
    backgroundColor: '#7c46e8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonSmallAlt: {
    backgroundColor: '#f5f0ff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ded1fb'
  },
  buttonSmallAltText: {
    color: '#5a31b3',
    fontWeight: '800'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800'
  },
  kvValue: {
    marginTop: 6,
    color: '#303247'
  },
  kvLabel: {
    fontWeight: '700',
    color: '#41345d'
  },
  statusRow: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  statusBadgeInfo: {
    backgroundColor: '#e9f3ff',
    borderColor: '#aac8ee'
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800'
  },
  statusTextInfo: {
    color: '#134f8f'
  },
  note: {
    borderWidth: 1,
    borderColor: '#ece7f6',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fcfbff'
  },
  noteMsg: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2f2743'
  },
  noteMeta: {
    marginTop: 6,
    color: '#7a7490',
    fontSize: 12
  }
});
