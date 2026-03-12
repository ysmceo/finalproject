import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { apiGet, apiPostJson, ApiError } from '../lib/api';
import { useThemePrefs } from '../theme';
import type { Service, Product, Booking, PaystackStatusResponse, MonnifyStatusResponse } from '../types';
import { getMobilePalette, MOBILE_MOTION, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';
import { ThemedScrollView } from '../ui/ThemedScrollView';

type CreateBookingResponse = {
  message: string;
  booking: Booking;
  paymentBankDetails: null | {
    bankName: string;
    accountNumber: string;
    accountName: string;
    reference: string;
    amountDueNow: number;
  };
};

type PaystackInitResponse = {
  message: string;
  authorizationUrl: string;
  reference: string;
};

type MonnifyInitResponse = {
  message: string;
  checkoutUrl: string;
  paymentReference: string;
  transactionReference: string;
};

type ProductSelection = {
  productId: number;
  quantity: number;
  product: Product;
};

type BookingSlotsResponse = {
  date: string;
  slots: string[];
  blockedSlots: string[];
  totalSlots: number;
  availableCount: number;
};

type AddressSuggestion = {
  displayName: string;
  lat: string;
  lon: string;
};

type BookSectionKey = 'details' | 'services' | 'products' | 'schedule' | 'payment' | 'preview';

const LAST_BOOKING_ID_KEY = 'ceosalon:lastBookingId';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';
const LAST_BOOKING_NAME_KEY = 'ceosalon:lastBookingName';
const LAST_BOOKING_PHONE_KEY = 'ceosalon:lastBookingPhone';
const MIN_ADDRESS_QUERY_LENGTH = 4;

function normalizeEmailInput(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePhoneInput(value: string): string {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

function isValidEmailAddress(email: string): boolean {
  const normalized = normalizeEmailInput(email);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

function formatDateYYYYMMDD(input: Date): string {
  const y = input.getFullYear();
  const m = String(input.getMonth() + 1).padStart(2, '0');
  const d = String(input.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function plusDays(days: number): string {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return formatDateYYYYMMDD(next);
}

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
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function BookScreen() {
  const navigation = useNavigation<any>();
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreateBookingResponse | null>(null);

  // Basic form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [productQuantities, setProductQuantities] = useState<Record<number, number>>({});
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [language, setLanguage] = useState('English');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Credit Card'>('Bank Transfer');
  const [paymentPlan, setPaymentPlan] = useState<'deposit_50' | 'full'>('deposit_50');
  const [homeServiceRequested, setHomeServiceRequested] = useState(false);
  const [homeServiceAddress, setHomeServiceAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingAddressSuggestions, setLoadingAddressSuggestions] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState('');
  const [refreshment, setRefreshment] = useState<'No' | 'Yes'>('No');
  const [specialRequests, setSpecialRequests] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [paystackStatus, setPaystackStatus] = useState<PaystackStatusResponse | null>(null);
  const [monnifyStatus, setMonnifyStatus] = useState<MonnifyStatusResponse | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [sectionOffsets, setSectionOffsets] = useState<Record<BookSectionKey, number>>({
    details: 0,
    services: 0,
    products: 0,
    schedule: 0,
    payment: 0,
    preview: 0
  });
  const [activeSection, setActiveSection] = useState<'services' | 'products' | 'booking'>('services');
  const suppressNextAddressLookup = useRef(false);
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
    let active = true;
    (async () => {
      try {
        setLoadingServices(true);
        const [svc, productList, ps, mn] = await Promise.all([
          apiGet<Service[]>('/api/services'),
          apiGet<Product[]>('/api/products'),
          apiGet<PaystackStatusResponse>('/api/payments/paystack/status').catch(() => null),
          apiGet<MonnifyStatusResponse>('/api/payments/monnify/status').catch(() => null)
        ]);
        if (!active) return;
        setServices(svc || []);
        setProducts(productList || []);
        setSelectedServiceIds(svc.length ? [svc[0].id] : []);
        if (ps) setPaystackStatus(ps);
        if (mn) setMonnifyStatus(mn);
      } catch (error) {
        if (!active) return;
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load services');
      } finally {
        if (active) setLoadingServices(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [savedName, savedEmail, savedPhone] = await Promise.all([
          AsyncStorage.getItem(LAST_BOOKING_NAME_KEY),
          AsyncStorage.getItem(LAST_BOOKING_EMAIL_KEY),
          AsyncStorage.getItem(LAST_BOOKING_PHONE_KEY)
        ]);

        if (!active) return;
        if (savedName && !name) setName(savedName);
        if (savedEmail && !email) setEmail(savedEmail);
        if (savedPhone && !phone) setPhone(savedPhone);
      } catch {
        // ignore
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedServices = useMemo(() => {
    if (!selectedServiceIds.length) return [];
    return services.filter(s => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  const selectedService = selectedServices[0] || null;

  const selectedProducts = useMemo<ProductSelection[]>(() => {
    return Object.entries(productQuantities)
      .map(([id, qty]) => ({
        productId: Number(id),
        quantity: Number(qty || 0),
        product: products.find(p => Number(p.id) === Number(id)) as Product
      }))
      .filter(item => item.quantity > 0 && item.product);
  }, [productQuantities, products]);

  const defaultQuickTimes = ['09:00', '12:00', '15:00', '18:00'];
  const quickTimes = availableSlots.length ? availableSlots : defaultQuickTimes;
  const serviceSubtotal = useMemo(() => {
    return selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
  }, [selectedServices]);

  const totalDuration = useMemo(() => {
    return selectedServices.reduce((sum, service) => sum + Number(service.duration || 0), 0);
  }, [selectedServices]);

  const productsSubtotal = useMemo(() => {
    return selectedProducts.reduce((sum, item) => {
      return sum + (Number(item.product.price || 0) * Number(item.quantity || 0));
    }, 0);
  }, [selectedProducts]);

  const serviceDueNowPreview = useMemo(() => {
    return paymentPlan === 'deposit_50' ? Math.round(serviceSubtotal * 0.5) : serviceSubtotal;
  }, [serviceSubtotal, paymentPlan]);

  const dueNowPreview = useMemo(() => {
    return serviceDueNowPreview + productsSubtotal;
  }, [serviceDueNowPreview, productsSubtotal]);

  const totalPreview = useMemo(() => {
    return serviceSubtotal + productsSubtotal;
  }, [serviceSubtotal, productsSubtotal]);

  const selectedProductUnits = useMemo(() => {
    return selectedProducts.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [selectedProducts]);

  const canSubmit = useMemo(() => {
    if (!selectedServiceIds.length) return false;
    if (!name.trim()) return false;
    if (!isValidEmailAddress(email)) return false;
    if (!normalizePhoneInput(phone)) return false;
    if (!date.trim() || !time.trim()) return false;
    if (homeServiceRequested && !homeServiceAddress.trim()) return false;
    return true;
  }, [selectedServiceIds, name, email, phone, date, time, homeServiceRequested, homeServiceAddress]);

  const selectedDateValue = useMemo(() => {
    const normalized = String(date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return new Date();
    }

    const parsed = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [date]);

  useEffect(() => {
    if (!homeServiceRequested) {
      setAddressSuggestions([]);
      setLoadingAddressSuggestions(false);
      setAddressLookupError('');
      return;
    }

    const q = String(homeServiceAddress || '').trim();
    if (q.length < MIN_ADDRESS_QUERY_LENGTH) {
      setAddressSuggestions([]);
      setLoadingAddressSuggestions(false);
      setAddressLookupError('');
      return;
    }

    if (suppressNextAddressLookup.current) {
      suppressNextAddressLookup.current = false;
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      try {
        setLoadingAddressSuggestions(true);
        setAddressLookupError('');
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json'
          }
        });

        if (!res.ok) {
          throw new Error(`Address lookup failed (${res.status})`);
        }

        const payload = await res.json();
        if (!active) return;

        const next: AddressSuggestion[] = Array.isArray(payload)
          ? payload
              .map((item: any) => ({
                displayName: String(item?.display_name || '').trim(),
                lat: String(item?.lat || '').trim(),
                lon: String(item?.lon || '').trim()
              }))
              .filter((item: AddressSuggestion) => item.displayName)
          : [];

        setAddressSuggestions(next);
      } catch (error) {
        if (!active) return;
        setAddressSuggestions([]);
        setAddressLookupError(error instanceof Error ? error.message : 'Could not fetch address suggestions');
      } finally {
        if (active) setLoadingAddressSuggestions(false);
      }
    }, 380);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [homeServiceRequested, homeServiceAddress]);

  function useSuggestedAddress(item: AddressSuggestion) {
    suppressNextAddressLookup.current = true;
    setHomeServiceAddress(item.displayName);
    setAddressSuggestions([]);
    setAddressLookupError('');
  }

  async function openAddressInMap(value?: string) {
    const query = String(value || homeServiceAddress || '').trim();
    if (!query) {
      Alert.alert('Address needed', 'Type or choose an address first.');
      return;
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    try {
      await Linking.openURL(mapsUrl);
    } catch {
      Alert.alert('Map unavailable', 'Could not open map app right now.');
    }
  }

  const selectedTimeValue = useMemo(() => {
    const normalized = String(time || '').trim();
    const now = new Date();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
      return now;
    }

    const [hours, minutes] = normalized.split(':').map(Number);
    const value = new Date(now);
    value.setHours(hours, minutes, 0, 0);
    return value;
  }, [time]);

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

  function toggleServiceSelection(id: number) {
    setSelectedServiceIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((item) => item !== id);
        return next;
      }
      return [...prev, id];
    });
  }

  function updateProductQuantity(productId: number, nextQuantity: number) {
    setProductQuantities((prev) => {
      if (nextQuantity <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [productId]: nextQuantity
      };
    });
  }

  function handleDatePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }

    if (event.type !== 'set' || !selected) return;
    setDate(formatDateYYYYMMDD(selected));
  }

  function handleTimePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== 'ios') {
      setShowTimePicker(false);
    }

    if (event.type !== 'set' || !selected) return;
    const hh = String(selected.getHours()).padStart(2, '0');
    const mm = String(selected.getMinutes()).padStart(2, '0');
    setTime(`${hh}:${mm}`);
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const normalizedDate = date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
        setAvailableSlots([]);
        setSlotsError('');
        return;
      }

      try {
        setLoadingSlots(true);
        setSlotsError('');
        const response = await apiGet<BookingSlotsResponse>(`/api/bookings/available-slots?date=${encodeURIComponent(normalizedDate)}`);
        if (!active) return;
        const slots = Array.isArray(response.slots) ? response.slots : [];
        setAvailableSlots(slots);

        if (time && !slots.includes(time)) {
          setTime('');
        }
      } catch (error) {
        if (!active) return;
        setAvailableSlots([]);
        setSlotsError(error instanceof Error ? error.message : 'Failed to load available slots');
      } finally {
        if (active) setLoadingSlots(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [date]);

  async function createBooking() {
    if (!selectedServiceIds.length) {
      Alert.alert('Missing info', 'Please select at least one service.');
      return;
    }
    if (!name.trim() || !email.trim() || !phone.trim() || !date.trim() || !time.trim()) {
      Alert.alert('Missing info', 'Please fill in name, email, phone, date, and time.');
      return;
    }
    if (!isValidEmailAddress(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (availableSlots.length > 0 && !availableSlots.includes(time.trim())) {
      Alert.alert('Time unavailable', 'Please choose one of the available time slots.');
      return;
    }
    if (homeServiceRequested && !homeServiceAddress.trim()) {
      Alert.alert('Missing info', 'Please enter your home service address.');
      return;
    }

    setCreating(true);
    setCreated(null);
    try {
      const payload = {
        name: name.trim(),
        email: normalizeEmailInput(email),
        phone: normalizePhoneInput(phone),
        serviceId: selectedServiceIds[0],
        serviceIds: selectedServiceIds,
        date: date.trim(),
        time: time.trim(),
        language: language.trim(),
        paymentMethod,
        paymentPlan,
        homeServiceRequested: homeServiceRequested ? 'true' : 'false',
        homeServiceAddress: homeServiceAddress.trim(),
        refreshment,
        specialRequests: specialRequests.trim(),
        productSelections: selectedProducts.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      };

      const response = await apiPostJson<CreateBookingResponse>('/api/bookings', payload);
      setCreated(response);
      await AsyncStorage.multiSet([
        [LAST_BOOKING_ID_KEY, response.booking.id],
        [LAST_BOOKING_EMAIL_KEY, response.booking.email],
        [LAST_BOOKING_NAME_KEY, name.trim()],
        [LAST_BOOKING_PHONE_KEY, phone.trim()]
      ]);

      Alert.alert('Booking created', 'Your booking has been created successfully.');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : 'Failed to create booking');
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  }

  async function payWithPaystack() {
    const booking = created?.booking;
    if (!booking) return;
    try {
      const init = await apiPostJson<PaystackInitResponse>('/api/payments/paystack/initialize', {
        bookingId: booking.id,
        email: booking.email,
        paymentChannel: 'card'
      });
      await WebBrowser.openBrowserAsync(init.authorizationUrl);
    } catch (error) {
      Alert.alert('Payment error', error instanceof Error ? error.message : 'Failed to initialize Paystack');
    }
  }

  async function payWithMonnify() {
    const booking = created?.booking;
    if (!booking) return;
    try {
      const init = await apiPostJson<MonnifyInitResponse>('/api/payments/monnify/initialize', {
        bookingId: booking.id,
        email: booking.email
      });
      await WebBrowser.openBrowserAsync(init.checkoutUrl);
    } catch (error) {
      Alert.alert('Payment error', error instanceof Error ? error.message : 'Failed to initialize Monnify');
    }
  }

  function goToTrack() {
    const booking = created?.booking;
    if (!booking) return;
    navigation.navigate('Track', { bookingId: booking.id, email: booking.email });
  }

  async function useLastSavedDetails() {
    const [savedName, savedEmail, savedPhone] = await Promise.all([
      AsyncStorage.getItem(LAST_BOOKING_NAME_KEY),
      AsyncStorage.getItem(LAST_BOOKING_EMAIL_KEY),
      AsyncStorage.getItem(LAST_BOOKING_PHONE_KEY)
    ]);

    if (!savedName && !savedEmail && !savedPhone) {
      Alert.alert('No saved details', 'Create a booking once to save your details.');
      return;
    }

    if (savedName) setName(savedName);
    if (savedEmail) setEmail(savedEmail);
    if (savedPhone) setPhone(savedPhone);
    Alert.alert('Loaded', 'Saved details restored.');
  }

  function clearForm() {
    setCreated(null);
    setName('');
    setEmail('');
    setPhone('');
    setSelectedServiceIds(services.length ? [services[0].id] : []);
    setProductQuantities({});
    setDate('');
    setTime('');
    setLanguage('English');
    setPaymentMethod('Bank Transfer');
    setPaymentPlan('deposit_50');
    setHomeServiceRequested(false);
    setHomeServiceAddress('');
    setAddressSuggestions([]);
    setAddressLookupError('');
    setRefreshment('No');
    setSpecialRequests('');
  }

  async function shareBookingDetails() {
    if (!created?.booking) return;
    const booking = created.booking;
    const selectedServiceNames = selectedServices.length
      ? selectedServices.map((service) => service.name).join(', ')
      : '';
    const message = [
      'D CEO OFFICIAL UNISEX SALON APP',
      `Tracking Code: ${booking.trackingCode || booking.id}`,
      `Service(s): ${booking.serviceName || selectedServiceNames || selectedService?.name || 'N/A'}`,
      `Date/Time: ${booking.date} ${booking.time}`,
      `Due now: ₦${Number(booking.amountDueNow || 0).toLocaleString()}`
    ].join('\n');

    try {
      await Share.share({
        title: 'Booking Details',
        message
      });
    } catch {
      Alert.alert('Share failed', 'Could not share booking details.');
    }
  }

  function handleScrollPosition(y: number) {
    const shouldShow = y > 360;
    setShowBackToTop((prev) => (prev === shouldShow ? prev : shouldShow));
  }

  function scrollToTop() {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }

  function setSectionOffset(section: BookSectionKey, y: number) {
    setSectionOffsets((prev) => ({ ...prev, [section]: y }));
  }

  function jumpToSection(section: BookSectionKey) {
    const y = Number(sectionOffsets[section] || 0);
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 110), animated: true });
  }

  const themed = {
    containerBg: { backgroundColor: palette.bg },
    centerBg: { backgroundColor: palette.bg },
    card: { backgroundColor: palette.card, borderColor: palette.border },
    cardBorder: { borderColor: palette.border },
    label: { color: palette.text },
    bodyText: { color: palette.text },
    mutedText: { color: palette.textMuted },
    input: { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
    chip: { backgroundColor: palette.primarySoft, borderColor: palette.border },
    chipText: { color: palette.primary },
    chipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
    chipActiveText: { color: '#ffffff' },
    picker: { backgroundColor: palette.inputBg, borderColor: palette.border },
    suggestionCard: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    suggestionText: { color: palette.text },
    suggestionMeta: { color: palette.textMuted },
    mapLinkText: { color: palette.primary },
    heroCard: {
      backgroundColor: isDark ? '#172744' : '#eef4ff',
      borderColor: isDark ? '#314b7e' : '#cedbf5'
    },
    heroKicker: { color: isDark ? '#f4d98a' : palette.warm },
    heroTitle: { color: isDark ? '#ffffff' : '#16233b' },
    heroSub: { color: isDark ? '#dbe6ff' : '#5d6f88' },
    heroNavChip: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
      borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#d7e2f2'
    },
    heroNavChipText: { color: isDark ? '#ffffff' : '#274268' },
    cardTitle: { color: palette.warm },
    reachabilityTitle: { color: palette.textMuted },
    sectionTitle: { color: palette.text },
    productCard: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    qtyButton: { backgroundColor: palette.primarySoft, borderColor: palette.border },
    qtyButtonText: { color: palette.primary },
    previewBox: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    previewTitle: { color: palette.primary },
    previewDue: { color: palette.text },
    cardInner: {
      backgroundColor: isDark ? '#18263c' : '#fff7e7',
      borderColor: isDark ? '#334667' : '#ead8a7'
    },
    button: { backgroundColor: palette.primary },
    buttonSmallAlt: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    buttonSmallAltText: { color: palette.text },
    progressChip: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    progressChipText: { color: palette.primary },
    selectionBadge: { backgroundColor: palette.primarySoft, borderColor: palette.border },
    selectionBadgeText: { color: palette.primary },
    mono: { color: palette.text },
    errorText: { color: palette.danger },
    skeletonCard: {
      marginTop: 14,
      borderRadius: MOBILE_SHAPE.cardRadius,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.card
    },
    skeletonLine: {
      height: 12,
      borderRadius: 999,
      backgroundColor: isDark ? '#242a45' : '#e9e4f5'
    }
  };

  if (loadingServices) {
    return (
      <View style={[styles.center, themed.centerBg]}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={[{ marginTop: 12 }, themed.mutedText]}>Loading services…</Text>
        <View style={themed.skeletonCard}>
          <View style={[themed.skeletonLine, { width: '48%', marginBottom: 12 }]} />
          <View style={[themed.skeletonLine, { width: '92%', marginBottom: 8 }]} />
          <View style={[themed.skeletonLine, { width: '88%', marginBottom: 8 }]} />
          <View style={[themed.skeletonLine, { width: '76%' }]} />
        </View>
        <View style={themed.skeletonCard}>
          <View style={[themed.skeletonLine, { width: '42%', marginBottom: 12 }]} />
          <View style={[themed.skeletonLine, { width: '100%', height: 42, borderRadius: 10, marginBottom: 10 }]} />
          <View style={[themed.skeletonLine, { width: '100%', height: 42, borderRadius: 10 }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenWrap}>
    <ThemedScrollView
      ref={scrollViewRef}
      contentContainerStyle={[styles.container, themed.containerBg]}
      keyboardShouldPersistTaps="handled"
      onScroll={(event) => handleScrollPosition(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
    >
      <Animated.View style={[styles.heroCard, themed.heroCard, cardIn(20)]}>
        <Text style={[styles.heroKicker, themed.heroKicker]}>CEO UNISEX SALON</Text>
        <Text style={[styles.h1, themed.heroTitle]}>Book an Appointment</Text>
        <Text style={[styles.sub, themed.heroSub]}>Fast, polished booking with instant tracking and payment options.</Text>

        <View style={styles.quickNavRow}>
          <MicroPress style={[styles.quickNavChip, themed.heroNavChip]} onPress={() => navigation.navigate('Track')}>
            <Text style={[styles.quickNavChipText, themed.heroNavChipText]}>Go to Track</Text>
          </MicroPress>
          <MicroPress style={[styles.quickNavChip, themed.heroNavChip]} onPress={() => navigation.navigate('Contact')}>
            <Text style={[styles.quickNavChipText, themed.heroNavChipText]}>Contact</Text>
          </MicroPress>
          <MicroPress style={[styles.quickNavChip, themed.heroNavChip]} onPress={() => navigation.navigate('More')}>
            <Text style={[styles.quickNavChipText, themed.heroNavChipText]}>More</Text>
          </MicroPress>
        </View>
      </Animated.View>

      <Animated.View style={[styles.card, themed.card, cardIn(28)]}>
        <Text style={[styles.cardTitle, themed.cardTitle]}>Booking Details</Text>
        <Text style={[styles.reachabilityTitle, themed.reachabilityTitle]}>Jump to section</Text>
        <View style={[styles.rowWrap, styles.scheduleInputRow]}>
          <MicroPress style={[styles.quickChip, themed.chip]} onPress={() => jumpToSection('details')}>
            <Text style={[styles.quickChipText, themed.chipText]}>Your details</Text>
          </MicroPress>
          <MicroPress style={[styles.quickChip, themed.chip]} onPress={() => jumpToSection('services')}>
            <Text style={[styles.quickChipText, themed.chipText]}>Services</Text>
          </MicroPress>
          <MicroPress style={[styles.quickChip, themed.chip]} onPress={() => jumpToSection('products')}>
            <Text style={[styles.quickChipText, themed.chipText]}>Products</Text>
          </MicroPress>
          <MicroPress style={[styles.quickChip, themed.chip]} onPress={() => jumpToSection('schedule')}>
            <Text style={[styles.quickChipText, themed.chipText]}>Schedule</Text>
          </MicroPress>
          <MicroPress style={[styles.quickChip, themed.chip]} onPress={() => jumpToSection('payment')}>
            <Text style={[styles.quickChipText, themed.chipText]}>Payment</Text>
          </MicroPress>
          <MicroPress style={[styles.quickChip, themed.chip]} onPress={() => jumpToSection('preview')}>
            <Text style={[styles.quickChipText, themed.chipText]}>Preview</Text>
          </MicroPress>
        </View>
        <View style={styles.progressChipRow}>
          <View style={[styles.progressChip, themed.progressChip]}><Text style={[styles.progressChipText, themed.progressChipText]}>1. Your details</Text></View>
          <View style={[styles.progressChip, themed.progressChip]}><Text style={[styles.progressChipText, themed.progressChipText]}>2. Schedule</Text></View>
          <View style={[styles.progressChip, themed.progressChip]}><Text style={[styles.progressChipText, themed.progressChipText]}>3. Confirm</Text></View>
        </View>
        <View style={styles.selectionSummaryRow}>
          <View style={[styles.selectionBadge, themed.selectionBadge]}>
            <Text style={[styles.selectionBadgeText, themed.selectionBadgeText]}>Services: {selectedServiceIds.length}</Text>
          </View>
          <View style={[styles.selectionBadge, themed.selectionBadge]}>
            <Text style={[styles.selectionBadgeText, themed.selectionBadgeText]}>Products: {selectedProductUnits}</Text>
          </View>
        </View>
        <View style={[styles.rowWrap, styles.scheduleChipRow]}>
          <MicroPress style={[styles.quickChip, themed.chip]} onPress={useLastSavedDetails}>
            <Text style={[styles.quickChipText, themed.chipText]}>Use saved details</Text>
          </MicroPress>
          <MicroPress style={[styles.quickChip, themed.chip]} onPress={clearForm}>
            <Text style={[styles.quickChipText, themed.chipText]}>Clear form</Text>
          </MicroPress>
        </View>

        <View onLayout={(event) => setSectionOffset('details', event.nativeEvent.layout.y)} />
        <Text style={[styles.sectionTitle, themed.sectionTitle]}>Your details</Text>
        <Text style={[styles.label, themed.label]}>Name</Text>
        <TextInput style={[styles.input, themed.input]} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={palette.textMuted} />

        <Text style={[styles.label, themed.label]}>Email</Text>
        <TextInput
          style={[styles.input, themed.input]}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmail(normalizeEmailInput(email))}
          placeholder="you@example.com"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={[styles.label, themed.label]}>Phone</Text>
        <TextInput
          style={[styles.input, themed.input]}
          value={phone}
          onChangeText={setPhone}
          onBlur={() => setPhone(normalizePhoneInput(phone))}
          placeholder="080..."
          placeholderTextColor={palette.textMuted}
          keyboardType="phone-pad"
        />

        <View onLayout={(event) => setSectionOffset('services', event.nativeEvent.layout.y)} />
        <Text style={[styles.sectionTitle, themed.sectionTitle]}>Services</Text>
        <Text style={[styles.label, themed.label]}>Services (select one or more)</Text>
        <View style={[styles.rowWrap, styles.scheduleInputRow]}>
          {services.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.pill, themed.chip, selectedServiceIds.includes(s.id) && themed.chipActive]}
              onPress={() => toggleServiceSelection(s.id)}
            >
              <Text style={[styles.pillText, themed.chipText, selectedServiceIds.includes(s.id) && themed.chipActiveText]}>
                {selectedServiceIds.includes(s.id) ? '✓ ' : ''}{s.name} (₦{Number(s.price).toLocaleString()})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View onLayout={(event) => setSectionOffset('products', event.nativeEvent.layout.y)} />
        <Text style={[styles.sectionTitle, themed.sectionTitle]}>Products</Text>
        <Text style={[styles.label, themed.label]}>Products (optional add-ons)</Text>
        <View style={[styles.rowWrap, styles.scheduleChipRow]}>
          {products.map((product) => {
            const quantity = Number(productQuantities[product.id] || 0);
            return (
              <View key={product.id} style={[styles.productCard, themed.productCard]}>
                <View style={styles.productInfo}>
                <Text style={[styles.productName, themed.bodyText]} numberOfLines={1}>{product.name}</Text>
                <Text style={[styles.productMeta, themed.mutedText]}>₦{Number(product.price || 0).toLocaleString()} • Stock: {Number(product.stock || 0)}</Text>
                </View>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={[styles.qtyButton, themed.qtyButton]}
                    onPress={() => updateProductQuantity(product.id, quantity - 1)}
                    disabled={quantity <= 0}
                  >
                    <Text style={[styles.qtyButtonText, themed.qtyButtonText]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, themed.bodyText]}>{quantity}</Text>
                  <TouchableOpacity
                    style={[styles.qtyButton, themed.qtyButton]}
                    onPress={() => updateProductQuantity(product.id, quantity + 1)}
                    disabled={quantity >= Number(product.stock || 0)}
                  >
                    <Text style={[styles.qtyButtonText, themed.qtyButtonText]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View onLayout={(event) => setSectionOffset('schedule', event.nativeEvent.layout.y)} />
        <Text style={[styles.sectionTitle, themed.sectionTitle]}>Schedule</Text>
        <View style={styles.scheduleFieldBlock}>
        <Text style={[styles.label, themed.label]}>Date (YYYY-MM-DD)</Text>
        <View style={styles.rowWrap}>
          <TouchableOpacity style={[styles.pickerButton, themed.picker]} onPress={() => setShowDatePicker(true)}>
            <Text style={[styles.pickerButtonText, themed.bodyText]}>{date || 'Pick a date'}</Text>
          </TouchableOpacity>
        </View>
        </View>
        <View style={styles.rowWrap}>
          <TouchableOpacity style={[styles.quickChip, themed.chip]} onPress={() => setDate(formatDateYYYYMMDD(new Date()))}>
            <Text style={[styles.quickChipText, themed.chipText]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickChip, themed.chip]} onPress={() => setDate(plusDays(1))}>
            <Text style={[styles.quickChipText, themed.chipText]}>Tomorrow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickChip, themed.chip]} onPress={() => setDate(plusDays(2))}>
            <Text style={[styles.quickChipText, themed.chipText]}>+2 days</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scheduleFieldBlock}>
        <Text style={[styles.label, themed.label]}>Time (HH:MM)</Text>
        <View style={styles.rowWrap}>
          <TouchableOpacity style={[styles.pickerButton, themed.picker]} onPress={() => setShowTimePicker(true)}>
            <Text style={[styles.pickerButtonText, themed.bodyText]}>{time || 'Pick a time'}</Text>
          </TouchableOpacity>
        </View>
        </View>
        {loadingSlots ? <Text style={[styles.hint, themed.mutedText, styles.scheduleStatusText]}>Checking available slots…</Text> : null}
        {!!slotsError ? <Text style={[styles.errorText, themed.errorText, styles.scheduleStatusText]}>{slotsError}</Text> : null}
        {!loadingSlots && date.trim() && availableSlots.length === 0 ? (
          <Text style={[styles.hint, themed.mutedText, styles.scheduleStatusText]}>No slots available for this date. Try another date.</Text>
        ) : null}
        <View style={styles.rowWrap}>
          {quickTimes.map((t) => (
            <TouchableOpacity key={t} style={[styles.quickChip, themed.chip, time === t && themed.chipActive]} onPress={() => setTime(t)}>
              <Text style={[styles.quickChipText, themed.chipText, time === t && themed.chipActiveText]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {showDatePicker ? (
          <DateTimePicker
            value={selectedDateValue}
            mode="date"
            onChange={handleDatePickerChange}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
          />
        ) : null}

        {showTimePicker ? (
          <DateTimePicker
            value={selectedTimeValue}
            mode="time"
            is24Hour
            onChange={handleTimePickerChange}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          />
        ) : null}

        <View style={styles.scheduleFieldBlock}>
        <Text style={[styles.label, themed.label]}>Language</Text>
        <TextInput style={[styles.input, themed.input, styles.scheduleLanguageInput]} value={language} onChangeText={setLanguage} placeholder="English" placeholderTextColor={palette.textMuted} />
        </View>

        <View onLayout={(event) => setSectionOffset('payment', event.nativeEvent.layout.y)} />
        <Text style={[styles.sectionTitle, themed.sectionTitle]}>Payment</Text>
        <Text style={[styles.label, themed.label]}>Payment method</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.pill, themed.chip, paymentMethod === 'Bank Transfer' && themed.chipActive]}
            onPress={() => setPaymentMethod('Bank Transfer')}
          >
            <Text style={[styles.pillText, themed.chipText, paymentMethod === 'Bank Transfer' && themed.chipActiveText]}>Bank Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, themed.chip, paymentMethod === 'Credit Card' && themed.chipActive]}
            onPress={() => setPaymentMethod('Credit Card')}
          >
            <Text style={[styles.pillText, themed.chipText, paymentMethod === 'Credit Card' && themed.chipActiveText]}>Credit Card</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, themed.label]}>Payment plan</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.pill, themed.chip, paymentPlan === 'deposit_50' && themed.chipActive]}
            onPress={() => setPaymentPlan('deposit_50')}
          >
            <Text style={[styles.pillText, themed.chipText, paymentPlan === 'deposit_50' && themed.chipActiveText]}>50% Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, themed.chip, paymentPlan === 'full' && themed.chipActive]}
            onPress={() => setPaymentPlan('full')}
          >
            <Text style={[styles.pillText, themed.chipText, paymentPlan === 'full' && themed.chipActiveText]}>Full Payment</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.row, { justifyContent: 'space-between', marginTop: 10 }]}>
          <Text style={[styles.label, themed.label]}>Home service?</Text>
          <Switch value={homeServiceRequested} onValueChange={setHomeServiceRequested} />
        </View>

        {homeServiceRequested ? (
          <>
            <Text style={[styles.label, themed.label]}>Home service address</Text>
            <TextInput
              style={[styles.input, themed.input]}
              value={homeServiceAddress}
              onChangeText={(value) => {
                setHomeServiceAddress(value);
                if (!value.trim()) {
                  setAddressSuggestions([]);
                  setAddressLookupError('');
                }
              }}
              placeholder="Address"
              placeholderTextColor={palette.textMuted}
            />
            <View style={styles.rowWrap}>
              <MicroPress style={[styles.quickChip, themed.chip]} onPress={() => openAddressInMap()}>
                <Text style={[styles.quickChipText, themed.mapLinkText]}>Open map</Text>
              </MicroPress>
            </View>
            {loadingAddressSuggestions ? <Text style={[styles.hint, themed.mutedText]}>Searching nearby address matches…</Text> : null}
            {!!addressLookupError ? <Text style={[styles.errorText, themed.errorText]}>{addressLookupError}</Text> : null}
            {addressSuggestions.length ? (
              <View style={[styles.addressSuggestionList, themed.suggestionCard]}>
                {addressSuggestions.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.displayName}-${item.lat}-${item.lon}-${index}`}
                    style={[
                      styles.addressSuggestionItem,
                      index !== addressSuggestions.length - 1 && styles.addressSuggestionItemBorder,
                      index !== addressSuggestions.length - 1 && { borderBottomColor: palette.border }
                    ]}
                    onPress={() => useSuggestedAddress(item)}
                  >
                    <Text style={[styles.addressSuggestionText, themed.suggestionText]} numberOfLines={2}>{item.displayName}</Text>
                    <Text style={[styles.addressSuggestionMeta, themed.suggestionMeta]}>Lat {item.lat} • Lng {item.lon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={[styles.label, themed.label]}>Refreshment</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.pill, themed.chip, refreshment === 'No' && themed.chipActive]} onPress={() => setRefreshment('No')}>
            <Text style={[styles.pillText, themed.chipText, refreshment === 'No' && themed.chipActiveText]}>No</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, themed.chip, refreshment === 'Yes' && themed.chipActive]} onPress={() => setRefreshment('Yes')}>
            <Text style={[styles.pillText, themed.chipText, refreshment === 'Yes' && themed.chipActiveText]}>Yes</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, themed.label]}>Special requests (optional)</Text>
        <TextInput
          style={[styles.input, themed.input, { height: 90, textAlignVertical: 'top' }]}
          value={specialRequests}
          onChangeText={setSpecialRequests}
          placeholder="Anything we should know?"
          placeholderTextColor={palette.textMuted}
          multiline
        />

        <MicroPress style={[styles.button, themed.button, (!canSubmit || creating) && styles.buttonDisabled]} onPress={createBooking} disabled={!canSubmit || creating}>
          <Text style={styles.buttonText}>{creating ? 'Creating…' : 'Create booking'}</Text>
        </MicroPress>
        {!canSubmit ? <Text style={[styles.hint, themed.mutedText]}>Complete required fields to continue.</Text> : null}

        {selectedServices.length ? (
          <View style={[styles.previewBox, themed.previewBox]}>
            <View onLayout={(event) => setSectionOffset('preview', event.nativeEvent.layout.y)} />
            <Text style={[styles.previewTitle, themed.previewTitle]}>Booking preview</Text>
            <Text style={[styles.hint, themed.mutedText]}>Services: {selectedServices.map((service) => service.name).join(', ')}</Text>
            <Text style={[styles.hint, themed.mutedText]}>Duration: {totalDuration} mins</Text>
            <Text style={[styles.hint, themed.mutedText]}>Services total: ₦{Number(serviceSubtotal).toLocaleString()}</Text>
            <Text style={[styles.hint, themed.mutedText]}>Products total: ₦{Number(productsSubtotal).toLocaleString()}</Text>
            <Text style={[styles.hint, themed.mutedText]}>Order total: ₦{Number(totalPreview).toLocaleString()}</Text>
            <Text style={[styles.previewDue, themed.previewDue]}>Due now: ₦{Number(dueNowPreview).toLocaleString()}</Text>
          </View>
        ) : null}
      </Animated.View>

      {created ? (
        <Animated.View style={[styles.card, themed.card, cardIn(36)]}>
          <Text style={[styles.cardTitle, themed.cardTitle]}>Booking Created</Text>
          <Text style={[styles.h2, themed.bodyText]}>Booking created 🎉</Text>
          <Text style={[styles.mono, themed.mono]}>Booking ID: {created.booking.id}</Text>
          <Text style={[styles.mono, themed.mono]}>Amount due now: ₦{Number(created.booking.amountDueNow || 0).toLocaleString()}</Text>
          <Text style={[{ marginTop: 8 }, themed.bodyText]}>{created.message}</Text>

          {created.paymentBankDetails ? (
            <View style={[styles.cardInner, themed.cardInner, { marginTop: 12 }]}>
              <Text style={[styles.h3, themed.bodyText]}>Bank Transfer Details</Text>
              <Text style={[styles.mono, themed.mono]}>{created.paymentBankDetails.bankName}</Text>
              <Text style={[styles.mono, themed.mono]}>{created.paymentBankDetails.accountNumber}</Text>
              <Text style={[styles.mono, themed.mono]}>{created.paymentBankDetails.accountName}</Text>
              <Text style={[styles.mono, themed.mono]}>Reference: {created.paymentBankDetails.reference}</Text>
            </View>
          ) : null}

          <View style={[styles.row, { marginTop: 12 }]}>
            <MicroPress style={[styles.buttonSmall, themed.button]} onPress={goToTrack}>
              <Text style={styles.buttonText}>Track booking</Text>
            </MicroPress>
            <MicroPress style={[styles.buttonSmallAlt, themed.buttonSmallAlt]} onPress={shareBookingDetails}>
              <Text style={[styles.buttonSmallAltText, themed.buttonSmallAltText]}>Share</Text>
            </MicroPress>
          </View>

          {paymentMethod === 'Credit Card' ? (
            <>
              <Text style={[styles.hint, themed.mutedText, { marginTop: 12 }]}>
                Pay online (opens in browser):
              </Text>
              <View style={styles.rowWrap}>
                <MicroPress
                  style={[styles.buttonSmall, themed.button, !(paystackStatus?.configured) && styles.buttonDisabled]}
                  onPress={payWithPaystack}
                  disabled={!paystackStatus?.configured}
                >
                  <Text style={styles.buttonText}>Paystack</Text>
                </MicroPress>

                <MicroPress
                  style={[styles.buttonSmall, themed.button, !(monnifyStatus?.configured) && styles.buttonDisabled]}
                  onPress={payWithMonnify}
                  disabled={!monnifyStatus?.configured}
                >
                  <Text style={styles.buttonText}>Monnify</Text>
                </MicroPress>
              </View>
              {paystackStatus && !paystackStatus.configured ? (
                <Text style={[styles.hint, themed.mutedText]}>{paystackStatus.message}</Text>
              ) : null}
              {monnifyStatus && !monnifyStatus.configured ? (
                <Text style={[styles.hint, themed.mutedText]}>{monnifyStatus.message}</Text>
              ) : null}
            </>
          ) : null}
        </Animated.View>
      ) : null}
    </ThemedScrollView>
    <View style={[styles.floatingQuickNav, showBackToTop && styles.floatingQuickNavRaised]}>
      <MicroPress
        style={[styles.floatingQuickNavBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
        onPress={() => jumpToSection('details')}
      >
        <Text numberOfLines={1} style={[styles.floatingQuickNavText, { color: palette.text }]}>Details</Text>
      </MicroPress>
      <MicroPress
        style={[styles.floatingQuickNavBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
        onPress={() => jumpToSection('schedule')}
      >
        <Text numberOfLines={1} style={[styles.floatingQuickNavText, { color: palette.text }]}>Schedule</Text>
      </MicroPress>
      <MicroPress
        style={[styles.floatingQuickNavBtn, { backgroundColor: palette.primarySoft, borderColor: palette.border }]}
        onPress={() => jumpToSection('preview')}
      >
        <Text numberOfLines={1} style={[styles.floatingQuickNavText, { color: palette.primary }]}>Preview</Text>
      </MicroPress>
    </View>
    {showBackToTop ? (
      <Pressable style={[styles.backToTopButton, { backgroundColor: palette.primary }]} onPress={scrollToTop}>
        <Text style={styles.backToTopText}>Top</Text>
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
    padding: MOBILE_SPACE.xxl,
    paddingBottom: 36,
    backgroundColor: '#f6f8fc'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f8fc'
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
    marginBottom: 6
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
    borderWidth: 1
  },
  quickNavChipText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: MOBILE_TYPE.caption
  },
  heroCard: {
    backgroundColor: '#37166d',
    borderRadius: 18,
    padding: MOBILE_SPACE.xxl,
    borderWidth: 1,
    borderColor: '#5f35af',
    shadowColor: '#2a0b57',
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
  reachabilityTitle: {
    marginTop: MOBILE_SPACE.xs,
    marginBottom: MOBILE_SPACE.xxs,
    color: '#5a6175',
    fontWeight: '700',
    fontSize: MOBILE_TYPE.caption
  },
  card: {
    marginTop: MOBILE_SPACE.xl,
    borderRadius: MOBILE_SHAPE.cardRadius,
    padding: MOBILE_SPACE.xl,
    borderWidth: 1,
    shadowColor: '#160a2a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3
  },
  cardInner: {
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
  sectionTitle: {
    marginTop: MOBILE_SPACE.lg,
    marginBottom: MOBILE_SPACE.xxs,
    fontSize: MOBILE_TYPE.subheading,
    fontWeight: '900',
    color: '#2f3b58'
  },
  scheduleFieldBlock: {
    marginTop: MOBILE_SPACE.md
  },
  scheduleInputRow: {
    marginTop: MOBILE_SPACE.xs
  },
  scheduleChipRow: {
    marginTop: MOBILE_SPACE.sm
  },
  scheduleStatusText: {
    marginTop: MOBILE_SPACE.sm
  },
  scheduleLanguageInput: {
    marginTop: MOBILE_SPACE.xs
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d2e8',
    borderRadius: MOBILE_SHAPE.inputRadius,
    paddingHorizontal: MOBILE_SPACE.lg,
    paddingVertical: MOBILE_SPACE.md,
    backgroundColor: '#fff'
  },
  row: {
    flexDirection: 'row',
    gap: MOBILE_SPACE.md,
    alignItems: 'center'
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.md,
    alignItems: 'center'
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: MOBILE_SHAPE.chipRadius,
    borderWidth: 1,
    borderColor: '#d8d0e8',
    backgroundColor: '#fff'
  },
  pillActive: {
    borderColor: '#7c46e8',
    backgroundColor: '#f4edff'
  },
  pillText: {
    color: '#333'
  },
  pillTextActive: {
    color: '#5a31b3',
    fontWeight: '700'
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
  buttonSmallAlt: {
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: MOBILE_SPACE.md,
    paddingHorizontal: MOBILE_SPACE.lg,
    alignItems: 'center',
    borderWidth: 1
  },
  buttonSmallAltText: {
    color: '#5a31b3',
    fontWeight: '800'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800'
  },
  hint: {
    marginTop: MOBILE_SPACE.md,
    color: '#6f6a87'
  },
  errorText: {
    marginTop: MOBILE_SPACE.sm,
    color: '#b00020',
    fontWeight: '700'
  },
  quickChip: {
    paddingHorizontal: MOBILE_SPACE.lg,
    paddingVertical: MOBILE_SPACE.sm,
    borderRadius: MOBILE_SHAPE.chipRadius,
    backgroundColor: '#f1ebff',
    borderWidth: 1,
    borderColor: '#dfd3fa'
  },
  quickChipActive: {
    backgroundColor: '#7c46e8',
    borderColor: '#6c37da'
  },
  quickChipText: {
    color: '#5f3ea1',
    fontWeight: '700'
  },
  quickChipTextActive: {
    color: '#ffffff'
  },
  pickerButton: {
    minHeight: 42,
    minWidth: 180,
    paddingHorizontal: MOBILE_SPACE.lg,
    paddingVertical: MOBILE_SPACE.md,
    borderRadius: MOBILE_SHAPE.inputRadius,
    borderWidth: 1,
    borderColor: '#d9d2e8',
    backgroundColor: '#fff'
  },
  pickerButtonText: {
    color: '#3b2f54',
    fontWeight: '700'
  },
  selectionSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.sm,
    marginBottom: MOBILE_SPACE.sm
  },
  progressChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.sm,
    marginBottom: MOBILE_SPACE.md
  },
  progressChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: MOBILE_SHAPE.chipRadius,
    borderWidth: 1,
    borderColor: '#e6dcfb',
    backgroundColor: '#faf7ff'
  },
  progressChipText: {
    color: '#5a31b3',
    fontSize: MOBILE_TYPE.micro,
    fontWeight: '800'
  },
  selectionBadge: {
    paddingHorizontal: MOBILE_SPACE.md,
    paddingVertical: MOBILE_SPACE.xs,
    borderRadius: MOBILE_SHAPE.chipRadius,
    backgroundColor: '#efe8ff',
    borderWidth: 1,
    borderColor: '#d8c8fb'
  },
  selectionBadgeText: {
    color: '#4f2a96',
    fontWeight: '800',
    fontSize: MOBILE_TYPE.caption
  },
  productCard: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: MOBILE_SPACE.md,
    borderWidth: 1,
    borderColor: '#e0d6f7',
    backgroundColor: '#fbf9ff',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: 10
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: MOBILE_SPACE.sm
  },
  productName: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '800',
    color: '#32204f'
  },
  productMeta: {
    marginTop: MOBILE_SPACE.xxs,
    color: '#6f6289',
    fontSize: MOBILE_TYPE.caption
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: MOBILE_SPACE.md,
    minWidth: 106
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#ccb7f5',
    backgroundColor: '#f2eaff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  qtyButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5a31b3'
  },
  qtyText: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#2d2342'
  },
  previewBox: {
    marginTop: MOBILE_SPACE.lg,
    borderWidth: 1,
    borderColor: '#e6dcfb',
    backgroundColor: '#f9f5ff',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.lg
  },
  previewTitle: {
    color: '#4f2a96',
    fontSize: MOBILE_TYPE.label,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  previewDue: {
    marginTop: MOBILE_SPACE.md,
    color: '#2d2342',
    fontWeight: '900'
  },
  addressSuggestionList: {
    marginTop: MOBILE_SPACE.sm,
    borderWidth: 1,
    borderRadius: MOBILE_SHAPE.controlRadius,
    overflow: 'hidden'
  },
  addressSuggestionItem: {
    paddingHorizontal: MOBILE_SPACE.lg,
    paddingVertical: MOBILE_SPACE.md,
    backgroundColor: 'transparent'
  },
  addressSuggestionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#d9d2e8'
  },
  addressSuggestionText: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700'
  },
  addressSuggestionMeta: {
    marginTop: MOBILE_SPACE.xxs,
    fontSize: MOBILE_TYPE.caption
  },
  mono: {
    marginTop: MOBILE_SPACE.xs,
    color: '#303247'
  },
  backToTopButton: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    backgroundColor: '#7c46e8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#2a0b57',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4
  },
  backToTopText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: MOBILE_TYPE.caption
  },
  floatingQuickNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    flexDirection: 'row',
    gap: MOBILE_SPACE.sm,
    alignItems: 'center'
  },
  floatingQuickNavRaised: {
    bottom: 72
  },
  floatingQuickNavBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    borderRadius: MOBILE_SHAPE.chipRadius,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d2538',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2
  },
  floatingQuickNavText: {
    fontSize: MOBILE_TYPE.micro,
    fontWeight: '800',
    textAlign: 'center'
  }
});
