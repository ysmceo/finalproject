import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
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

import { apiGet, apiPostJson, ApiError } from '../lib/api';
import type { Service, Product, Booking, PaystackStatusResponse, MonnifyStatusResponse } from '../types';

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

const LAST_BOOKING_ID_KEY = 'ceosalon:lastBookingId';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';
const LAST_BOOKING_NAME_KEY = 'ceosalon:lastBookingName';
const LAST_BOOKING_PHONE_KEY = 'ceosalon:lastBookingPhone';

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

export default function BookScreen() {
  const navigation = useNavigation<any>();

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
  const [language, setLanguage] = useState('English');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Credit Card'>('Bank Transfer');
  const [paymentPlan, setPaymentPlan] = useState<'deposit_50' | 'full'>('deposit_50');
  const [homeServiceRequested, setHomeServiceRequested] = useState(false);
  const [homeServiceAddress, setHomeServiceAddress] = useState('');
  const [refreshment, setRefreshment] = useState<'No' | 'Yes'>('No');
  const [specialRequests, setSpecialRequests] = useState('');

  const [paystackStatus, setPaystackStatus] = useState<PaystackStatusResponse | null>(null);
  const [monnifyStatus, setMonnifyStatus] = useState<MonnifyStatusResponse | null>(null);
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

  const quickTimes = ['09:00', '12:00', '15:00', '18:00'];
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

  async function createBooking() {
    if (!selectedServiceIds.length) {
      Alert.alert('Missing info', 'Please select at least one service.');
      return;
    }
    if (!name.trim() || !email.trim() || !phone.trim() || !date.trim() || !time.trim()) {
      Alert.alert('Missing info', 'Please fill in name, email, phone, date, and time.');
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
        email: email.trim(),
        phone: phone.trim(),
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

  if (loadingServices) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading services…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Animated.View style={[styles.heroCard, cardIn(20)]}>
        <Text style={styles.heroKicker}>CEO UNISEX SALON</Text>
        <Text style={styles.h1}>Book an Appointment</Text>
        <Text style={styles.sub}>Fast, beautiful booking with instant tracking and payment options.</Text>
      </Animated.View>

      <Animated.View style={[styles.card, cardIn(28)]}>
        <Text style={styles.cardTitle}>Booking Details</Text>
        <View style={styles.selectionSummaryRow}>
          <View style={styles.selectionBadge}>
            <Text style={styles.selectionBadgeText}>Services: {selectedServiceIds.length}</Text>
          </View>
          <View style={styles.selectionBadge}>
            <Text style={styles.selectionBadgeText}>Products: {selectedProductUnits}</Text>
          </View>
        </View>
        <View style={styles.rowWrap}>
          <MicroPress style={styles.quickChip} onPress={useLastSavedDetails}>
            <Text style={styles.quickChipText}>Use saved details</Text>
          </MicroPress>
          <MicroPress style={styles.quickChip} onPress={clearForm}>
            <Text style={styles.quickChipText}>Clear form</Text>
          </MicroPress>
        </View>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="080..." keyboardType="phone-pad" />

        <Text style={styles.label}>Services (select one or more)</Text>
        <View style={styles.rowWrap}>
          {services.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.pill, selectedServiceIds.includes(s.id) && styles.pillActive]}
              onPress={() => toggleServiceSelection(s.id)}
            >
              <Text style={[styles.pillText, selectedServiceIds.includes(s.id) && styles.pillTextActive]}>
                {selectedServiceIds.includes(s.id) ? '✓ ' : ''}{s.name} (₦{Number(s.price).toLocaleString()})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Products (optional add-ons)</Text>
        <View style={styles.rowWrap}>
          {products.map((product) => {
            const quantity = Number(productQuantities[product.id] || 0);
            return (
              <View key={product.id} style={styles.productCard}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productMeta}>₦{Number(product.price || 0).toLocaleString()} • Stock: {Number(product.stock || 0)}</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateProductQuantity(product.id, quantity - 1)}
                    disabled={quantity <= 0}
                  >
                    <Text style={styles.qtyButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateProductQuantity(product.id, quantity + 1)}
                    disabled={quantity >= Number(product.stock || 0)}
                  >
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-02-20" />
        <View style={styles.rowWrap}>
          <TouchableOpacity style={styles.quickChip} onPress={() => setDate(formatDateYYYYMMDD(new Date()))}>
            <Text style={styles.quickChipText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickChip} onPress={() => setDate(plusDays(1))}>
            <Text style={styles.quickChipText}>Tomorrow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickChip} onPress={() => setDate(plusDays(2))}>
            <Text style={styles.quickChipText}>+2 days</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Time (HH:MM)</Text>
        <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="10:00" />
        <View style={styles.rowWrap}>
          {quickTimes.map((t) => (
            <TouchableOpacity key={t} style={[styles.quickChip, time === t && styles.quickChipActive]} onPress={() => setTime(t)}>
              <Text style={[styles.quickChipText, time === t && styles.quickChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Language</Text>
        <TextInput style={styles.input} value={language} onChangeText={setLanguage} placeholder="English" />

        <Text style={styles.label}>Payment method</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.pill, paymentMethod === 'Bank Transfer' && styles.pillActive]}
            onPress={() => setPaymentMethod('Bank Transfer')}
          >
            <Text style={[styles.pillText, paymentMethod === 'Bank Transfer' && styles.pillTextActive]}>Bank Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, paymentMethod === 'Credit Card' && styles.pillActive]}
            onPress={() => setPaymentMethod('Credit Card')}
          >
            <Text style={[styles.pillText, paymentMethod === 'Credit Card' && styles.pillTextActive]}>Credit Card</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Payment plan</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.pill, paymentPlan === 'deposit_50' && styles.pillActive]}
            onPress={() => setPaymentPlan('deposit_50')}
          >
            <Text style={[styles.pillText, paymentPlan === 'deposit_50' && styles.pillTextActive]}>50% Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, paymentPlan === 'full' && styles.pillActive]}
            onPress={() => setPaymentPlan('full')}
          >
            <Text style={[styles.pillText, paymentPlan === 'full' && styles.pillTextActive]}>Full Payment</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.row, { justifyContent: 'space-between', marginTop: 10 }]}>
          <Text style={styles.label}>Home service?</Text>
          <Switch value={homeServiceRequested} onValueChange={setHomeServiceRequested} />
        </View>

        {homeServiceRequested ? (
          <>
            <Text style={styles.label}>Home service address</Text>
            <TextInput style={styles.input} value={homeServiceAddress} onChangeText={setHomeServiceAddress} placeholder="Address" />
          </>
        ) : null}

        <Text style={styles.label}>Refreshment</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.pill, refreshment === 'No' && styles.pillActive]} onPress={() => setRefreshment('No')}>
            <Text style={[styles.pillText, refreshment === 'No' && styles.pillTextActive]}>No</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, refreshment === 'Yes' && styles.pillActive]} onPress={() => setRefreshment('Yes')}>
            <Text style={[styles.pillText, refreshment === 'Yes' && styles.pillTextActive]}>Yes</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Special requests (optional)</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          value={specialRequests}
          onChangeText={setSpecialRequests}
          placeholder="Anything we should know?"
          multiline
        />

        <MicroPress style={[styles.button, creating && styles.buttonDisabled]} onPress={createBooking} disabled={creating}>
          <Text style={styles.buttonText}>{creating ? 'Creating…' : 'Create booking'}</Text>
        </MicroPress>

        {selectedServices.length ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Booking preview</Text>
            <Text style={styles.hint}>Services: {selectedServices.map((service) => service.name).join(', ')}</Text>
            <Text style={styles.hint}>Duration: {totalDuration} mins</Text>
            <Text style={styles.hint}>Services total: ₦{Number(serviceSubtotal).toLocaleString()}</Text>
            <Text style={styles.hint}>Products total: ₦{Number(productsSubtotal).toLocaleString()}</Text>
            <Text style={styles.hint}>Order total: ₦{Number(totalPreview).toLocaleString()}</Text>
            <Text style={styles.previewDue}>Due now: ₦{Number(dueNowPreview).toLocaleString()}</Text>
          </View>
        ) : null}
      </Animated.View>

      {created ? (
        <Animated.View style={[styles.card, cardIn(36)]}>
          <Text style={styles.cardTitle}>Booking Created</Text>
          <Text style={styles.h2}>Booking created 🎉</Text>
          <Text style={styles.mono}>Booking ID: {created.booking.id}</Text>
          <Text style={styles.mono}>Amount due now: ₦{Number(created.booking.amountDueNow || 0).toLocaleString()}</Text>
          <Text style={{ marginTop: 8 }}>{created.message}</Text>

          {created.paymentBankDetails ? (
            <View style={[styles.cardInner, { marginTop: 12 }]}>
              <Text style={styles.h3}>Bank Transfer Details</Text>
              <Text style={styles.mono}>{created.paymentBankDetails.bankName}</Text>
              <Text style={styles.mono}>{created.paymentBankDetails.accountNumber}</Text>
              <Text style={styles.mono}>{created.paymentBankDetails.accountName}</Text>
              <Text style={styles.mono}>Reference: {created.paymentBankDetails.reference}</Text>
            </View>
          ) : null}

          <View style={[styles.row, { marginTop: 12 }]}>
            <MicroPress style={[styles.buttonSmall]} onPress={goToTrack}>
              <Text style={styles.buttonText}>Track booking</Text>
            </MicroPress>
            <MicroPress style={[styles.buttonSmallAlt]} onPress={shareBookingDetails}>
              <Text style={styles.buttonSmallAltText}>Share</Text>
            </MicroPress>
          </View>

          {paymentMethod === 'Credit Card' ? (
            <>
              <Text style={[styles.hint, { marginTop: 12 }]}>
                Pay online (opens in browser):
              </Text>
              <View style={styles.rowWrap}>
                <MicroPress
                  style={[styles.buttonSmall, !(paystackStatus?.configured) && styles.buttonDisabled]}
                  onPress={payWithPaystack}
                  disabled={!paystackStatus?.configured}
                >
                  <Text style={styles.buttonText}>Paystack</Text>
                </MicroPress>

                <MicroPress
                  style={[styles.buttonSmall, !(monnifyStatus?.configured) && styles.buttonDisabled]}
                  onPress={payWithMonnify}
                  disabled={!monnifyStatus?.configured}
                >
                  <Text style={styles.buttonText}>Monnify</Text>
                </MicroPress>
              </View>
              {paystackStatus && !paystackStatus.configured ? (
                <Text style={styles.hint}>{paystackStatus.message}</Text>
              ) : null}
              {monnifyStatus && !monnifyStatus.configured ? (
                <Text style={styles.hint}>{monnifyStatus.message}</Text>
              ) : null}
            </>
          ) : null}
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
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
    backgroundColor: '#37166d',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#5f35af',
    shadowColor: '#2a0b57',
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
    backgroundColor: '#fff',
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
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center'
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
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
  buttonSmallAlt: {
    backgroundColor: '#f1ebff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dccffb'
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
    marginTop: 10,
    color: '#6f6a87'
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
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
  selectionSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  selectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#efe8ff',
    borderWidth: 1,
    borderColor: '#d8c8fb'
  },
  selectionBadgeText: {
    color: '#4f2a96',
    fontWeight: '800',
    fontSize: 12
  },
  productCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0d6f7',
    backgroundColor: '#fbf9ff',
    borderRadius: 12,
    padding: 10
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#32204f'
  },
  productMeta: {
    marginTop: 4,
    color: '#6f6289',
    fontSize: 12
  },
  quantityRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
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
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e6dcfb',
    backgroundColor: '#f9f5ff',
    borderRadius: 12,
    padding: 12
  },
  previewTitle: {
    color: '#4f2a96',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  previewDue: {
    marginTop: 10,
    color: '#2d2342',
    fontWeight: '900'
  },
  mono: {
    marginTop: 6,
    color: '#303247'
  }
});
