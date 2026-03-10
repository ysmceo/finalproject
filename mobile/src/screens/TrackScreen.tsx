import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';

import { apiGet, apiPostJson, ApiError } from '../lib/api';
import { buildApiUrl } from '../config';
import { useThemePrefs } from '../theme';
import type { ProductOrderTrackResponse, TrackResponse } from '../types';
import { getMobilePalette, MOBILE_MOTION, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';

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

type TimelineStep = {
  key: string;
  label: string;
  done: boolean;
};

function normalizeCodeInput(value: string) {
  return String(value || '').trim().toUpperCase();
}

function normalizeEmailInput(value: string) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmailAddress(email: string) {
  const normalized = normalizeEmailInput(email);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

function formatLastUpdated(notifications: Array<{ createdAt: string }> | undefined) {
  if (!Array.isArray(notifications) || !notifications.length) return 'No updates yet';
  const latest = notifications[notifications.length - 1];
  const date = latest && latest.createdAt ? new Date(latest.createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return 'No updates yet';
  return `Last update: ${date.toLocaleString()}`;
}

function MicroPress({
  onPress,
  style,
  children,
  disabled,
  accessibilityLabel,
  accessibilityHint
}: {
  onPress: () => void;
  style: any;
  children: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: MOBILE_MOTION.fast,
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
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
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
    const delay = Math.min(index * MOBILE_MOTION.stagger, MOBILE_MOTION.slow);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: MOBILE_MOTION.normal,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: MOBILE_MOTION.normal,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [index, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function TrackScreen(props: any) {
  const navigation = useNavigation<any>();
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);
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
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [sectionOffsets, setSectionOffsets] = useState<Record<'booking' | 'order' | 'results', number>>({
    booking: 0,
    order: 0,
    results: 0
  });
  const screenEntry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenEntry, {
      toValue: 1,
      duration: MOBILE_MOTION.slow,
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
      return isDark
        ? { label: '✅ Approved', bg: '#193227', color: '#9ce8ba', border: '#2f6b4a' }
        : { label: '✅ Approved', bg: '#e8f8ec', color: '#126d32', border: '#9ddfb2' };
    }
    if (normalized === 'cancelled' || normalized === 'rejected' || normalized === 'declined') {
      return isDark
        ? { label: '❌ Rejected', bg: '#381d24', color: '#ffb4b4', border: '#6b3340' }
        : { label: '❌ Rejected', bg: '#ffe9e9', color: '#9d1c1c', border: '#f2b0b0' };
    }
    if (normalized === 'completed') {
      return isDark
        ? { label: '🎉 Completed', bg: '#1d2f4a', color: '#b8d8ff', border: '#35547d' }
        : { label: '🎉 Completed', bg: '#e9f3ff', color: '#134f8f', border: '#aac8ee' };
    }
    return isDark
      ? { label: '⏳ Pending', bg: '#372d1f', color: '#ffd38a', border: '#69563a' }
      : { label: '⏳ Pending', bg: '#fff5df', color: '#8a5a00', border: '#f0d2a0' };
  }

  function isBookingPaidForCustomerNotice(paymentStatus: string, paidAmount: unknown) {
    const normalizedPaymentStatus = String(paymentStatus || '').trim().toLowerCase();
    const numericPaidAmount = Number(paidAmount || 0);
    if (numericPaidAmount > 0) return true;
    return ['paid', 'partial', 'partially_paid', 'partial_paid', 'part_paid'].includes(normalizedPaymentStatus);
  }

  function getBookingStatusSummary(status: string, paymentStatus: string, paidAmount: unknown) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved' || normalized === 'accepted') {
      return 'Your booking has been approved. We look forward to serving you.';
    }
    if (normalized === 'cancelled' || normalized === 'rejected' || normalized === 'declined') {
      return isBookingPaidForCustomerNotice(paymentStatus, paidAmount)
        ? 'Your booking was declined. If payment was made, your refund will be processed to your original payment method within 3 to 7 business days (bank timelines may vary slightly).'
        : 'Your booking was declined. Please contact the salon to reschedule a new time.';
    }
    if (normalized === 'completed') {
      return 'Your booking has been completed. Thank you for choosing CEO Unisex Salon.';
    }
    return 'Your booking is pending review by our admin team.';
  }

  function getProductOrderStatusMeta(status: string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved') {
      return isDark
        ? { label: '✅ Approved', bg: '#193227', color: '#9ce8ba', border: '#2f6b4a' }
        : { label: '✅ Approved', bg: '#e8f8ec', color: '#126d32', border: '#9ddfb2' };
    }
    if (normalized === 'processed') {
      return isDark
        ? { label: '🧾 Processed', bg: '#1f2d4d', color: '#b8d3ff', border: '#3a538c' }
        : { label: '🧾 Processed', bg: '#e9f1ff', color: '#1f4fa2', border: '#b9cdf5' };
    }
    if (normalized === 'shipped') {
      return isDark
        ? { label: '🚚 Shipped', bg: '#2d2144', color: '#ddb9ff', border: '#5a3e84' }
        : { label: '🚚 Shipped', bg: '#f3e9ff', color: '#5e2b8a', border: '#d2b8ee' };
    }
    if (normalized === 'on_the_way') {
      return isDark
        ? { label: '🛵 On the way', bg: '#3a2a1f', color: '#ffcb93', border: '#6e5038' }
        : { label: '🛵 On the way', bg: '#fff1e2', color: '#9a4d00', border: '#f2c79c' };
    }
    if (normalized === 'cancelled') {
      return isDark
        ? { label: '❌ Cancelled', bg: '#381d24', color: '#ffb4b4', border: '#6b3340' }
        : { label: '❌ Cancelled', bg: '#ffe9e9', color: '#9d1c1c', border: '#f2b0b0' };
    }
    if (normalized === 'delivered' || normalized === 'completed') {
      return isDark
        ? { label: '📦 Delivered', bg: '#193227', color: '#9ce8ba', border: '#2f6b4a' }
        : { label: '📦 Delivered', bg: '#e8f8ec', color: '#126d32', border: '#9ddfb2' };
    }
    return isDark
      ? { label: '⏳ Pending', bg: '#372d1f', color: '#ffd38a', border: '#69563a' }
      : { label: '⏳ Pending', bg: '#fff5df', color: '#8a5a00', border: '#f0d2a0' };
  }

  const themed = {
    container: { backgroundColor: palette.bg },
    card: { backgroundColor: palette.card, borderColor: palette.border },
    cardInner: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    text: { color: palette.text },
    mutedText: { color: palette.textMuted },
    input: { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
    buttonAlt: { backgroundColor: palette.primarySoft, borderColor: palette.border },
    buttonAltText: { color: palette.primary },
    progressTrack: { backgroundColor: isDark ? '#2a2f47' : '#ece7f6' },
    timelinePending: { color: palette.textMuted },
    timelineDotPending: { backgroundColor: isDark ? '#4b516d' : '#cfc7df' },
    note: { backgroundColor: isDark ? '#1b2135' : '#fcfbff', borderColor: palette.border },
    noteProduct: { backgroundColor: isDark ? '#202744' : '#f8f5ff', borderColor: palette.border }
  };

  function isPaidLike(paymentStatus: string) {
    const normalized = String(paymentStatus || '').trim().toLowerCase();
    return normalized === 'paid' || normalized === 'partial';
  }

  function bookingTimeline(status: string, paymentStatus: string): TimelineStep[] {
    const normalized = String(status || '').trim().toLowerCase();
    const paidLike = isPaidLike(paymentStatus);
    return [
      { key: 'created', label: 'Booking created', done: true },
      {
        key: 'review',
        label: 'Under review',
        done: ['pending', 'approved', 'accepted', 'completed'].includes(normalized)
      },
      {
        key: 'approved',
        label: 'Approved by salon',
        done: ['approved', 'accepted', 'completed'].includes(normalized)
      },
      {
        key: 'payment',
        label: 'Payment received',
        done: paidLike || ['completed'].includes(normalized)
      },
      {
        key: 'completed',
        label: 'Service completed',
        done: normalized === 'completed'
      }
    ];
  }

  function productOrderTimeline(status: string, paymentStatus: string): TimelineStep[] {
    const normalized = String(status || '').trim().toLowerCase();
    const paidLike = isPaidLike(paymentStatus);
    return [
      { key: 'placed', label: 'Order placed', done: true },
      {
        key: 'review',
        label: 'Order processing',
        done: ['pending', 'approved', 'processed', 'shipped', 'on_the_way', 'delivered'].includes(normalized)
      },
      {
        key: 'approved',
        label: 'Order approved',
        done: ['approved', 'processed', 'shipped', 'on_the_way', 'delivered'].includes(normalized)
      },
      {
        key: 'processed',
        label: 'Order processed',
        done: ['processed', 'shipped', 'on_the_way', 'delivered'].includes(normalized)
      },
      {
        key: 'shipped',
        label: 'Order shipped',
        done: ['shipped', 'on_the_way', 'delivered'].includes(normalized)
      },
      {
        key: 'on_the_way',
        label: 'On the way',
        done: ['on_the_way', 'delivered'].includes(normalized)
      },
      {
        key: 'payment',
        label: 'Payment confirmed',
        done: paidLike || normalized === 'delivered'
      },
      {
        key: 'delivered',
        label: 'Order delivered',
        done: normalized === 'delivered' || normalized === 'completed'
      }
    ];
  }

  function timelineProgressLabel(steps: TimelineStep[]) {
    const total = Array.isArray(steps) ? steps.length : 0;
    const completed = Array.isArray(steps) ? steps.filter((step) => step.done).length : 0;
    return `Progress: ${completed}/${total} steps completed`;
  }

  function timelineProgressPercent(steps: TimelineStep[]) {
    const total = Array.isArray(steps) ? steps.length : 0;
    if (!total) return 0;
    const completed = Array.isArray(steps) ? steps.filter((step) => step.done).length : 0;
    return Math.round((completed / total) * 100);
  }

  async function fetchTracking() {
    if (!canFetch) {
      Alert.alert('Missing info', 'Enter your Tracking Code and Email.');
      return;
    }

    const normalizedCode = normalizeCodeInput(trackingCode);
    const normalizedEmail = normalizeEmailInput(email);
    if (!isValidEmailAddress(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid booking email address.');
      return;
    }

    if (normalizedCode !== trackingCode) setTrackingCode(normalizedCode);
    if (normalizedEmail !== email) setEmail(normalizedEmail);

    setLoading(true);
    setData(null);
    setBankDetails(null);
    try {
      const res = await apiGet<TrackResponse>(`/api/bookings/track?trackingCode=${encodeURIComponent(normalizedCode)}&email=${encodeURIComponent(normalizedEmail)}`);
      setData(res);
      await AsyncStorage.setItem(LAST_TRACKING_CODE_KEY, String(res.booking.trackingCode || normalizedCode).toUpperCase());
      await AsyncStorage.setItem(LAST_BOOKING_EMAIL_KEY, normalizedEmail);
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

    const normalizedCode = normalizeCodeInput(orderCode);
    const normalizedEmail = normalizeEmailInput(orderEmail);
    if (!isValidEmailAddress(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid product order email address.');
      return;
    }

    if (normalizedCode !== orderCode) setOrderCode(normalizedCode);
    if (normalizedEmail !== orderEmail) setOrderEmail(normalizedEmail);

    setOrderLoading(true);
    setOrderData(null);
    try {
      const res = await apiGet<ProductOrderTrackResponse>(`/api/product-orders/track?orderCode=${encodeURIComponent(normalizedCode)}&email=${encodeURIComponent(normalizedEmail)}`);
      setOrderData(res);
      await AsyncStorage.setItem(LAST_PRODUCT_ORDER_CODE_KEY, String(res.order.orderCode || normalizedCode).toUpperCase());
      await AsyncStorage.setItem(LAST_PRODUCT_ORDER_EMAIL_KEY, normalizedEmail);
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

  async function copyOrderCodeToClipboard() {
    const code = String(orderData?.order?.orderCode || '').trim();
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Product order code copied to clipboard.');
  }

  async function openInvoiceInBrowser(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        await Clipboard.setStringAsync(url);
        Alert.alert('Cannot open link', 'Invoice URL copied to clipboard. Open it in your browser.');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open invoice URL';
      Alert.alert('Invoice error', message);
    }
  }

  async function downloadBookingInvoice() {
    const bookingCode = String(data?.booking?.trackingCode || data?.booking?.id || trackingCode || '').trim().toUpperCase();
    const bookingEmail = normalizeEmailInput(email || '');

    if (!bookingCode || !bookingEmail || !isValidEmailAddress(bookingEmail)) {
      Alert.alert('Missing details', 'Please track your booking with a valid email before downloading invoice.');
      return;
    }

    try {
      const link = await apiPostJson<{ secureInvoiceUrl: string }>('/api/invoices/access-link', {
        resourceType: 'booking',
        code: bookingCode,
        email: bookingEmail
      });

      const secureInvoiceUrl = String(link && link.secureInvoiceUrl ? link.secureInvoiceUrl : '').trim();
      if (!secureInvoiceUrl) {
        Alert.alert('Invoice error', 'Secure invoice link was not generated.');
        return;
      }

      await openInvoiceInBrowser(secureInvoiceUrl);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : 'Unable to fetch secure invoice link');
      Alert.alert('Invoice error', message);
    }
  }

  async function downloadProductInvoice() {
    const orderLookupCode = String(orderData?.order?.orderCode || orderData?.order?.id || orderCode || '').trim().toUpperCase();
    const productEmail = normalizeEmailInput(orderEmail || '');

    if (!orderLookupCode || !productEmail || !isValidEmailAddress(productEmail)) {
      Alert.alert('Missing details', 'Please track your product order with a valid email before downloading invoice.');
      return;
    }

    try {
      const link = await apiPostJson<{ secureInvoiceUrl: string }>('/api/invoices/access-link', {
        resourceType: 'product',
        code: orderLookupCode,
        email: productEmail
      });

      const secureInvoiceUrl = String(link && link.secureInvoiceUrl ? link.secureInvoiceUrl : '').trim();
      if (!secureInvoiceUrl) {
        Alert.alert('Invoice error', 'Secure invoice link was not generated.');
        return;
      }

      await openInvoiceInBrowser(secureInvoiceUrl);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : 'Unable to fetch secure invoice link');
      Alert.alert('Invoice error', message);
    }
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

  function handleScrollPosition(y: number) {
    const shouldShow = y > 360;
    setShowBackToTop((prev) => (prev === shouldShow ? prev : shouldShow));
  }

  function scrollToTop() {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }

  function setSectionOffset(section: 'booking' | 'order' | 'results', y: number) {
    setSectionOffsets((prev) => ({ ...prev, [section]: y }));
  }

  function jumpToSection(section: 'booking' | 'order' | 'results') {
    const y = Number(sectionOffsets[section] || 0);
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 110), animated: true });
  }

  return (
    <View style={styles.screenWrap}>
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, themed.container]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={(event) => handleScrollPosition(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
    >
      <Animated.View style={[styles.heroCard, cardIn(20)]}>
        <Text style={styles.heroKicker}>LIVE UPDATES</Text>
        <Text style={styles.h1}>Track your booking</Text>
        <Text style={styles.sub}>Follow booking and product order status in real time.</Text>

        <View style={styles.quickNavRow}>
          <MicroPress style={styles.quickNavChip} onPress={() => navigation.navigate('Book')}>
            <Text style={styles.quickNavChipText}>Go to Book</Text>
          </MicroPress>
          <MicroPress style={styles.quickNavChip} onPress={() => navigation.navigate('Contact')}>
            <Text style={styles.quickNavChipText}>Contact</Text>
          </MicroPress>
          <MicroPress style={styles.quickNavChip} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.quickNavChipText}>Settings</Text>
          </MicroPress>
        </View>
      </Animated.View>

      <Animated.View style={[styles.quickActionsCard, themed.card, cardIn(24)]}>
        <Text style={[styles.quickActionsTitle, themed.text]}>Quick actions</Text>
        <View style={styles.rowWrap}>
          <MicroPress
            style={[styles.buttonSmallAlt, themed.buttonAlt]}
            onPress={() => jumpToSection('booking')}
            accessibilityLabel="Jump to booking tracker"
            accessibilityHint="Scrolls to the booking tracker form"
          >
            <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Booking form</Text>
          </MicroPress>
          <MicroPress
            style={[styles.buttonSmallAlt, themed.buttonAlt]}
            onPress={() => jumpToSection('order')}
            accessibilityLabel="Jump to order tracker"
            accessibilityHint="Scrolls to the product order tracker form"
          >
            <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Order form</Text>
          </MicroPress>
          <MicroPress
            style={[styles.buttonSmallAlt, themed.buttonAlt]}
            onPress={() => jumpToSection('results')}
            accessibilityLabel="Jump to tracking results"
            accessibilityHint="Scrolls to booking and order status results"
          >
            <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Results</Text>
          </MicroPress>
        </View>
        <View style={styles.rowWrap}>
          <MicroPress
            style={[styles.buttonSmallAlt, themed.buttonAlt]}
            onPress={useSavedBookingDetails}
            accessibilityLabel="Load saved booking details"
            accessibilityHint="Loads your latest saved booking tracking code and email"
          >
            <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Load booking</Text>
          </MicroPress>
          <MicroPress
            style={[styles.buttonSmallAlt, themed.buttonAlt]}
            onPress={useSavedOrderDetails}
            accessibilityLabel="Load saved order details"
            accessibilityHint="Loads your latest saved product order code and email"
          >
            <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Load order</Text>
          </MicroPress>
        </View>
      </Animated.View>

      <Animated.View style={[styles.card, themed.card, cardIn(28)]}>
        <View onLayout={(event) => setSectionOffset('booking', event.nativeEvent.layout.y)} />
        <Text style={styles.cardTitle}>Booking Tracker</Text>
        <Text style={[styles.label, themed.text]}>Tracking Code</Text>
        <TextInput
          style={[styles.input, themed.input]}
          value={trackingCode}
          onChangeText={setTrackingCode}
          onBlur={() => setTrackingCode(normalizeCodeInput(trackingCode))}
          placeholder="e.g. BOOK-ABC12345"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <View style={styles.rowWrap}>
          <MicroPress
            style={[styles.buttonSmallAlt, themed.buttonAlt]}
            onPress={pasteTrackingCodeFromClipboard}
            accessibilityLabel="Paste booking tracking code"
            accessibilityHint="Pastes the tracking code from your clipboard"
          >
            <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Paste code</Text>
          </MicroPress>
        </View>
        <Text style={[styles.label, themed.text]}>Email</Text>
        <TextInput
          style={[styles.input, themed.input]}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmail(normalizeEmailInput(email))}
          placeholder="you@example.com"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <View style={styles.rowWrap}>
          <MicroPress
            style={[styles.buttonSmallAlt, themed.buttonAlt]}
            onPress={useSavedBookingDetails}
            accessibilityLabel="Use saved booking details"
            accessibilityHint="Loads your last saved booking tracking code and email"
          >
            <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Use saved booking</Text>
          </MicroPress>
        </View>

        <MicroPress
          style={[styles.button, (!canFetch || loading) && styles.buttonDisabled]}
          onPress={fetchTracking}
          disabled={!canFetch || loading}
          accessibilityLabel="Track booking"
          accessibilityHint="Fetches and shows your booking status and updates"
        >
          <Text style={styles.buttonText}>{loading ? 'Loading…' : 'Track booking'}</Text>
        </MicroPress>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#7c46e8" />
            <Text style={[styles.loadingText, themed.mutedText]}>Fetching booking details…</Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.card, themed.card, cardIn(34)]}>
        <View onLayout={(event) => setSectionOffset('order', event.nativeEvent.layout.y)} />
        <Text style={styles.cardTitle}>Product Order Tracker</Text>
        <Text style={[styles.h2, themed.text]}>Track your product order</Text>
        <Text style={[styles.label, themed.text]}>Product Order Code</Text>
        <TextInput
          style={[styles.input, themed.input]}
          value={orderCode}
          onChangeText={setOrderCode}
          onBlur={() => setOrderCode(normalizeCodeInput(orderCode))}
          placeholder="e.g. ORD-MA4N7X2"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Text style={[styles.label, themed.text]}>Order Email</Text>
        <TextInput
          style={[styles.input, themed.input]}
          value={orderEmail}
          onChangeText={setOrderEmail}
          onBlur={() => setOrderEmail(normalizeEmailInput(orderEmail))}
          placeholder="you@example.com"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <View style={styles.rowWrap}>
          <MicroPress
            style={[styles.buttonSmallAlt, themed.buttonAlt]}
            onPress={useSavedOrderDetails}
            accessibilityLabel="Use saved product order details"
            accessibilityHint="Loads your last saved product order code and email"
          >
            <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Use saved order</Text>
          </MicroPress>
        </View>

        <MicroPress
          style={[styles.button, (!canFetchOrder || orderLoading) && styles.buttonDisabled]}
          onPress={fetchProductTracking}
          disabled={!canFetchOrder || orderLoading}
          accessibilityLabel="Track product order"
          accessibilityHint="Fetches and shows your product order status and delivery updates"
        >
          <Text style={styles.buttonText}>{orderLoading ? 'Loading…' : 'Track product order'}</Text>
        </MicroPress>
        {orderLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#7c46e8" />
            <Text style={[styles.loadingText, themed.mutedText]}>Fetching product order details…</Text>
          </View>
        ) : null}
      </Animated.View>

      {!loading && !orderLoading && !data && !orderData ? (
        <Animated.View style={[styles.card, themed.card, cardIn(38)]}>
          <Text style={[styles.h2, themed.text]}>Get started</Text>
          <Text style={[styles.kvValue, themed.text]}>• Use your booking tracking code + booking email.</Text>
          <Text style={[styles.kvValue, themed.text]}>• For product orders, use order code + order email.</Text>
          <Text style={[styles.kvValue, themed.text]}>• You can load saved details from Quick actions above.</Text>
          <View style={[styles.note, themed.note, { marginTop: 12 }]}> 
            <Text style={[styles.noteMsg, themed.text]}>Tip: keep your tracking/order code in clipboard, then tap “Paste code” for faster lookup.</Text>
          </View>
        </Animated.View>
      ) : null}

      {data ? (
        <Animated.View style={[styles.card, themed.card, cardIn(40)]}>
          <View onLayout={(event) => setSectionOffset('results', event.nativeEvent.layout.y)} />
          <Text style={[styles.h2, themed.text]}>Booking</Text>
          <View style={styles.statusRow}>
            <Text style={[styles.kvLabel, themed.text]}>Status</Text>
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
          <Text style={[styles.kvValue, themed.text]}>
            {getBookingStatusSummary(data.booking.status, data.booking.paymentStatus, data.booking.paidAmount)}
          </Text>
          {(() => {
            const bookingSteps = bookingTimeline(data.booking.status, data.booking.paymentStatus);
            const bookingPercent = timelineProgressPercent(bookingSteps);
            return (
              <>
                <View style={styles.progressRow}>
                  <Text style={[styles.progressText, themed.mutedText]}>{timelineProgressLabel(bookingSteps)}</Text>
                  <Text style={styles.progressPercent}>{bookingPercent}%</Text>
                </View>
                <View
                  style={[styles.progressBarTrack, themed.progressTrack]}
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel="Booking progress"
                  accessibilityValue={{ min: 0, max: 100, now: bookingPercent }}
                >
                  <View style={[styles.progressBarFill, { width: `${bookingPercent}%` }]} />
                </View>
                <View style={styles.timelineWrap}>
                  {bookingSteps.map((step) => (
                    <View key={step.key} style={styles.timelineItem}>
                      <View style={[styles.timelineDot, step.done ? styles.timelineDotDone : styles.timelineDotPending, !step.done && themed.timelineDotPending]} />
                      <Text style={[styles.timelineText, step.done ? styles.timelineTextDone : styles.timelineTextPending, !step.done && themed.timelinePending]}>
                        {step.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            );
          })()}
          <Text style={[styles.kvValue, themed.text]}>Tracking Code: {String(data.booking.trackingCode || '').trim() || 'N/A'}</Text>
          <View style={styles.rowWrap}>
            <MicroPress
              style={[styles.buttonSmallAlt, themed.buttonAlt]}
              onPress={copyTrackingCodeToClipboard}
              accessibilityLabel="Copy booking tracking code"
              accessibilityHint="Copies your booking tracking code to the clipboard"
            >
              <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Copy tracking code</Text>
            </MicroPress>
            <MicroPress
              style={[styles.buttonSmallAlt, themed.buttonAlt]}
              onPress={downloadBookingInvoice}
              accessibilityLabel="Download booking invoice PDF"
              accessibilityHint="Opens your booking invoice PDF in browser"
            >
              <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Download invoice</Text>
            </MicroPress>
          </View>
          <Text style={[styles.kvValue, themed.text]}>Service: {data.booking.serviceName}</Text>
          <Text style={[styles.kvValue, themed.text]}>Date/Time: {data.booking.date} • {data.booking.time}</Text>
          <Text style={[styles.kvValue, themed.text]}>Payment: {data.booking.paymentStatus} ({data.booking.paymentPlan})</Text>
          <Text style={[styles.kvValue, themed.text]}>Due now: ₦{Number(data.booking.amountDueNow || 0).toLocaleString()}</Text>
          <Text style={[styles.kvValue, themed.text]}>Remaining: ₦{Number(data.booking.amountRemaining || 0).toLocaleString()}</Text>
          <Text style={[styles.updatedText, themed.mutedText]}>{formatLastUpdated(data.notifications)}</Text>
          {data.booking.serviceMode === 'home' ? (
            <Text style={[styles.kvValue, themed.text]}>Home address: {data.booking.homeServiceAddress}</Text>
          ) : null}

          {String(data.booking.paymentMethod || '').trim() === 'Bank Transfer' ? (
            <>
              <View style={styles.rowWrap}>
                <MicroPress
                  style={styles.buttonSmall}
                  onPress={fetchBankDetails}
                  accessibilityLabel="Load bank transfer details"
                  accessibilityHint="Shows account name, number, and reference for payment"
                >
                  <Text style={styles.buttonText}>Bank details</Text>
                </MicroPress>
                <MicroPress
                  style={[styles.buttonSmall, uploadingReceipt && styles.buttonDisabled]}
                  onPress={uploadReceipt}
                  disabled={uploadingReceipt}
                  accessibilityLabel="Upload payment receipt"
                  accessibilityHint="Lets you select and upload a receipt file"
                >
                  <Text style={styles.buttonText}>{uploadingReceipt ? 'Uploading…' : 'Upload receipt'}</Text>
                </MicroPress>
              </View>

              {bankDetails ? (
                <View style={[styles.cardInner, themed.cardInner]}>
                  <Text style={[styles.h3, themed.text]}>Bank Transfer Details</Text>
                  <Text style={[styles.kvValue, themed.text]}>{bankDetails.bankName}</Text>
                  <Text style={[styles.kvValue, themed.text]}>{bankDetails.accountNumber}</Text>
                  <Text style={[styles.kvValue, themed.text]}>{bankDetails.accountName}</Text>
                  <Text style={[styles.kvValue, themed.text]}>Reference: {bankDetails.reference}</Text>
                  <Text style={[styles.kvValue, themed.text]}>Amount due now: ₦{Number(bankDetails.amountDueNow || 0).toLocaleString()}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </Animated.View>
      ) : null}

      {orderData ? (
        <Animated.View style={[styles.card, themed.card, cardIn(48)]}>
          <Text style={[styles.h2, themed.text]}>Product Order</Text>
          {(() => {
            const productStatusMeta = getProductOrderStatusMeta(orderData.order.status);
            return (
          <View style={styles.statusRow}>
            <Text style={[styles.kvLabel, themed.text]}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: productStatusMeta.bg,
                  borderColor: productStatusMeta.border
                }
              ]}
            >
              <Text style={[styles.statusText, { color: productStatusMeta.color }]}> {productStatusMeta.label}</Text>
            </View>
          </View>
            );
          })()}
          {(() => {
            const productSteps = productOrderTimeline(orderData.order.status, orderData.order.paymentStatus);
            const productPercent = timelineProgressPercent(productSteps);
            return (
              <>
                <View style={styles.progressRow}>
                  <Text style={[styles.progressText, themed.mutedText]}>{timelineProgressLabel(productSteps)}</Text>
                  <Text style={styles.progressPercent}>{productPercent}%</Text>
                </View>
                <View
                  style={[styles.progressBarTrack, themed.progressTrack]}
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel="Product order progress"
                  accessibilityValue={{ min: 0, max: 100, now: productPercent }}
                >
                  <View style={[styles.progressBarFill, { width: `${productPercent}%` }]} />
                </View>
                <View style={styles.timelineWrap}>
                  {productSteps.map((step) => (
                    <View key={step.key} style={styles.timelineItem}>
                      <View style={[styles.timelineDot, step.done ? styles.timelineDotDone : styles.timelineDotPending, !step.done && themed.timelineDotPending]} />
                      <Text style={[styles.timelineText, step.done ? styles.timelineTextDone : styles.timelineTextPending, !step.done && themed.timelinePending]}>
                        {step.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            );
          })()}
          <Text style={[styles.kvValue, themed.text]}>Order Code: {String(orderData.order.orderCode || '').trim() || 'N/A'}</Text>
          <View style={styles.rowWrap}>
            <MicroPress
              style={[styles.buttonSmallAlt, themed.buttonAlt]}
              onPress={copyOrderCodeToClipboard}
              accessibilityLabel="Copy product order code"
              accessibilityHint="Copies your product order code to the clipboard"
            >
              <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Copy order code</Text>
            </MicroPress>
            <MicroPress
              style={[styles.buttonSmallAlt, themed.buttonAlt]}
              onPress={downloadProductInvoice}
              accessibilityLabel="Download product order invoice PDF"
              accessibilityHint="Opens your product order invoice PDF in browser"
            >
              <Text style={[styles.buttonSmallAltText, themed.buttonAltText]}>Download invoice</Text>
            </MicroPress>
          </View>
          <Text style={[styles.kvValue, themed.text]}>Delivery speed: {String(orderData.order.deliverySpeed || 'standard').toUpperCase()}</Text>
          <Text style={[styles.kvValue, themed.text]}>Payment: {orderData.order.paymentStatus} ({orderData.order.paymentMethod})</Text>
          <Text style={[styles.kvValue, themed.text]}>Subtotal: ₦{Number(orderData.order.itemsSubtotal || 0).toLocaleString()}</Text>
          <Text style={[styles.kvValue, themed.text]}>Delivery fee: ₦{Number(orderData.order.deliveryFee || 0).toLocaleString()}</Text>
          <Text style={[styles.kvValue, themed.text]}>Grand total: ₦{Number(orderData.order.totalAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.kvValue, themed.text]}>Due now: ₦{Number(orderData.order.amountDueNow || 0).toLocaleString()}</Text>
          <Text style={[styles.kvValue, themed.text]}>Remaining: ₦{Number(orderData.order.amountRemaining || 0).toLocaleString()}</Text>
          <Text style={[styles.updatedText, themed.mutedText]}>{formatLastUpdated(orderData.notifications)}</Text>
          <Text style={[styles.h3, themed.text, { marginTop: 10 }]}>Items</Text>
          {(orderData.order.items || []).map((item, index) => (
            <StaggerReveal key={`${item.productId}-${index}`} index={index}>
              <Text style={[styles.kvValue, themed.text]}>
                • {item.name} × {item.quantity} — ₦{Number(item.lineTotal || 0).toLocaleString()}
              </Text>
            </StaggerReveal>
          ))}

          <Text style={[styles.h3, themed.text, { marginTop: 12 }]}>Delivery updates</Text>
          <View style={{ paddingTop: 8, gap: 10 }}>
            {(Array.isArray(orderData.notifications) ? orderData.notifications : []).length ? (
              (Array.isArray(orderData.notifications) ? orderData.notifications : []).map((item, index) => (
                <StaggerReveal index={index} key={item.id || `${item.createdAt}-${index}`}>
                  <View style={[styles.noteProduct, themed.noteProduct]}>
                    <Text style={[styles.noteMsg, themed.text]}>{item.message}</Text>
                    <Text style={[styles.noteMeta, themed.mutedText]}>{new Date(item.createdAt).toLocaleString()}</Text>
                  </View>
                </StaggerReveal>
              ))
            ) : (
              <Text style={[styles.kvValue, themed.text]}>No delivery updates yet.</Text>
            )}
          </View>
        </Animated.View>
      ) : null}

      {data ? (
        <View style={[styles.card, themed.card, { flex: 1 }]}>
          <Text style={[styles.h2, themed.text]}>Notifications</Text>
          <View style={{ paddingVertical: 10, gap: 10 }}>
            {(Array.isArray(data.notifications) ? data.notifications : []).length ? (
              (Array.isArray(data.notifications) ? data.notifications : []).map((item, index) => (
                <StaggerReveal index={index} key={item.id || `${item.createdAt}-${index}`}>
                  <View style={[styles.note, themed.note]}>
                    <Text style={[styles.noteMsg, themed.text]}>{item.message}</Text>
                    <Text style={[styles.noteMeta, themed.mutedText]}>{new Date(item.createdAt).toLocaleString()}</Text>
                  </View>
                </StaggerReveal>
              ))
            ) : (
              <Text style={[styles.sub, themed.mutedText]}>No notifications yet.</Text>
            )}
          </View>
        </View>
      ) : null}
    </ScrollView>
    <View style={styles.floatingQuickNav}>
      <MicroPress
        style={[styles.floatingQuickNavBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
        onPress={() => jumpToSection('booking')}
      >
        <Text style={[styles.floatingQuickNavText, { color: palette.text }]}>Booking</Text>
      </MicroPress>
      <MicroPress
        style={[styles.floatingQuickNavBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
        onPress={() => jumpToSection('order')}
      >
        <Text style={[styles.floatingQuickNavText, { color: palette.text }]}>Order</Text>
      </MicroPress>
      <MicroPress
        style={[styles.floatingQuickNavBtn, { backgroundColor: palette.primarySoft, borderColor: palette.border }]}
        onPress={() => jumpToSection('results')}
      >
        <Text style={[styles.floatingQuickNavText, { color: palette.primary }]}>Results</Text>
      </MicroPress>
    </View>
    {showBackToTop ? (
      <Pressable style={styles.backToTopButton} onPress={scrollToTop}>
        <Text style={styles.backToTopText}>↑ Top</Text>
      </Pressable>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
    position: 'relative'
  },
  container: {
    flex: 1,
    backgroundColor: '#f6f8fc'
  },
  contentContainer: {
    padding: MOBILE_SPACE.xxl,
    paddingBottom: 24
  },
  h1: {
    fontSize: MOBILE_TYPE.title,
    fontWeight: '800',
    color: '#ffffff'
  },
  heroKicker: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800',
    color: '#f4d98a',
    letterSpacing: 1,
    marginBottom: MOBILE_SPACE.xs
  },
  h2: {
    fontSize: MOBILE_TYPE.heading,
    fontWeight: '800',
    color: '#2d2342'
  },
  h3: {
    fontSize: MOBILE_TYPE.subheading,
    fontWeight: '800',
    color: '#3b2a5e'
  },
  sub: {
    marginTop: MOBILE_SPACE.xs,
    color: '#e9dfff'
  },
  quickNavRow: {
    marginTop: MOBILE_SPACE.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.sm
  },
  quickNavChip: {
    paddingHorizontal: MOBILE_SPACE.md,
    paddingVertical: MOBILE_SPACE.xs,
    borderRadius: MOBILE_SHAPE.chipRadius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: 'rgba(255,255,255,0.16)'
  },
  quickNavChipText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: MOBILE_TYPE.caption
  },
  heroCard: {
    backgroundColor: '#2f1d63',
    borderRadius: 18,
    padding: MOBILE_SPACE.xxl,
    borderWidth: 1,
    borderColor: '#5f35af',
    shadowColor: '#220a4c',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4
  },
  cardTitle: {
    fontSize: MOBILE_TYPE.label,
    fontWeight: '700',
    color: '#8b5a11',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: MOBILE_SPACE.xxs
  },
  quickActionsCard: {
    marginTop: MOBILE_SPACE.lg,
    backgroundColor: '#ffffff',
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: MOBILE_SPACE.lg,
    paddingHorizontal: MOBILE_SPACE.xl,
    borderWidth: 1,
    borderColor: '#ece7f6'
  },
  quickActionsTitle: {
    fontSize: MOBILE_TYPE.label,
    fontWeight: '800',
    color: '#4d3489',
    marginBottom: 2
  },
  card: {
    marginTop: MOBILE_SPACE.xl,
    backgroundColor: '#ffffff',
    borderRadius: MOBILE_SHAPE.cardRadius,
    padding: MOBILE_SPACE.xl,
    borderWidth: 1,
    borderColor: '#ece7f6',
    shadowColor: '#160a2a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3
  },
  cardInner: {
    marginTop: MOBILE_SPACE.lg,
    backgroundColor: '#fff8e9',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.lg,
    borderWidth: 1,
    borderColor: '#f3dfb1'
  },
  label: {
    marginTop: MOBILE_SPACE.md,
    marginBottom: MOBILE_SPACE.xs,
    fontWeight: '700',
    color: '#3b2f54'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d2e8',
    borderRadius: MOBILE_SHAPE.inputRadius,
    paddingHorizontal: MOBILE_SPACE.lg,
    paddingVertical: MOBILE_SPACE.md,
    backgroundColor: '#fff'
  },
  rowWrap: {
    marginTop: MOBILE_SPACE.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.md,
    alignItems: 'center'
  },
  button: {
    marginTop: MOBILE_SPACE.xl,
    backgroundColor: '#7c46e8',
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: MOBILE_SPACE.lg,
    alignItems: 'center',
    shadowColor: '#4f22a8',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3
  },
  buttonSmall: {
    backgroundColor: '#7c46e8',
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: MOBILE_SPACE.md,
    paddingHorizontal: MOBILE_SPACE.lg,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonSmallAlt: {
    backgroundColor: '#f5f0ff',
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: MOBILE_SPACE.md,
    paddingHorizontal: MOBILE_SPACE.lg,
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
  loadingRow: {
    marginTop: MOBILE_SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOBILE_SPACE.sm
  },
  loadingText: {
    color: '#645b79',
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '700'
  },
  kvValue: {
    marginTop: MOBILE_SPACE.xs,
    color: '#303247'
  },
  kvLabel: {
    fontWeight: '700',
    color: '#41345d'
  },
  updatedText: {
    marginTop: MOBILE_SPACE.sm,
    color: '#7a7490',
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '700'
  },
  statusRow: {
    marginTop: MOBILE_SPACE.sm,
    marginBottom: MOBILE_SPACE.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: MOBILE_SPACE.md
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: MOBILE_SHAPE.chipRadius,
    paddingHorizontal: MOBILE_SPACE.md,
    paddingVertical: 5
  },
  statusBadgeInfo: {
    backgroundColor: '#e9f3ff',
    borderColor: '#aac8ee'
  },
  statusText: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  },
  statusTextInfo: {
    color: '#134f8f'
  },
  note: {
    borderWidth: 1,
    borderColor: '#ece7f6',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.lg,
    backgroundColor: '#fcfbff'
  },
  noteProduct: {
    borderWidth: 1,
    borderColor: '#e3dcf7',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.lg,
    backgroundColor: '#f8f5ff',
    shadowColor: '#2b155f',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 1
  },
  noteMsg: {
    fontSize: MOBILE_TYPE.body,
    lineHeight: 20,
    color: '#2f2743'
  },
  noteMeta: {
    marginTop: MOBILE_SPACE.xs,
    color: '#7a7490',
    fontSize: MOBILE_TYPE.caption
  },
  timelineWrap: {
    marginTop: MOBILE_SPACE.md,
    marginBottom: MOBILE_SPACE.sm,
    borderWidth: 1,
    borderColor: '#ece7f6',
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingHorizontal: MOBILE_SPACE.md,
    paddingVertical: MOBILE_SPACE.sm,
    backgroundColor: '#fcfbff',
    gap: MOBILE_SPACE.sm
  },
  progressText: {
    marginTop: MOBILE_SPACE.sm,
    color: '#5f5773',
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '700'
  },
  progressRow: {
    marginTop: MOBILE_SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: MOBILE_SPACE.sm
  },
  progressPercent: {
    color: '#4f22a8',
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  },
  progressBarTrack: {
    marginTop: MOBILE_SPACE.xs,
    marginBottom: 2,
    width: '100%',
    height: 8,
    borderRadius: MOBILE_SHAPE.chipRadius,
    backgroundColor: '#ece7f6',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: MOBILE_SHAPE.chipRadius,
    backgroundColor: '#7c46e8'
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOBILE_SPACE.sm
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  timelineDotDone: {
    backgroundColor: '#2eb872'
  },
  timelineDotPending: {
    backgroundColor: '#cfc7df'
  },
  timelineText: {
    fontSize: MOBILE_TYPE.label
  },
  timelineTextDone: {
    color: '#2a3e31',
    fontWeight: '700'
  },
  timelineTextPending: {
    color: '#726b84'
  },
  backToTopButton: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    backgroundColor: '#7c46e8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: MOBILE_SHAPE.chipRadius,
    shadowColor: '#220a4c',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4
  },
  backToTopText: {
    color: '#fff',
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '900'
  },
  floatingQuickNav: {
    position: 'absolute',
    left: 12,
    right: 78,
    bottom: 16,
    flexDirection: 'row',
    gap: MOBILE_SPACE.sm,
    alignItems: 'center'
  },
  floatingQuickNavBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: MOBILE_SHAPE.chipRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d2538',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2
  },
  floatingQuickNavText: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  }
});
