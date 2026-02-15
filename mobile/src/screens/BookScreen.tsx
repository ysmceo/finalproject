import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
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
import type { Service, Booking, PaystackStatusResponse, MonnifyStatusResponse } from '../types';

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

const LAST_BOOKING_ID_KEY = 'ceosalon:lastBookingId';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';

export default function BookScreen() {
  const navigation = useNavigation<any>();

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreateBookingResponse | null>(null);

  // Basic form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState<number | null>(null);
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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingServices(true);
        const [svc, ps, mn] = await Promise.all([
          apiGet<Service[]>('/api/services'),
          apiGet<PaystackStatusResponse>('/api/payments/paystack/status').catch(() => null),
          apiGet<MonnifyStatusResponse>('/api/payments/monnify/status').catch(() => null)
        ]);
        if (!active) return;
        setServices(svc);
        setServiceId(svc.length ? svc[0].id : null);
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

  const selectedService = useMemo(() => {
    return services.find(s => s.id === serviceId) || null;
  }, [services, serviceId]);

  async function createBooking() {
    if (!serviceId) {
      Alert.alert('Missing info', 'Please select a service.');
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
        serviceId,
        date: date.trim(),
        time: time.trim(),
        language: language.trim(),
        paymentMethod,
        paymentPlan,
        homeServiceRequested: homeServiceRequested ? 'true' : 'false',
        homeServiceAddress: homeServiceAddress.trim(),
        refreshment,
        specialRequests: specialRequests.trim()
      };

      const response = await apiPostJson<CreateBookingResponse>('/api/bookings', payload);
      setCreated(response);
      await AsyncStorage.setItem(LAST_BOOKING_ID_KEY, response.booking.id);
      await AsyncStorage.setItem(LAST_BOOKING_EMAIL_KEY, response.booking.email);

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
      <Text style={styles.h1}>Book an Appointment</Text>
      <Text style={styles.sub}>Create a booking using the same backend as your website.</Text>

      <View style={styles.card}>
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

        <Text style={styles.label}>Service</Text>
        <View style={styles.rowWrap}>
          {services.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.pill, serviceId === s.id && styles.pillActive]}
              onPress={() => setServiceId(s.id)}
            >
              <Text style={[styles.pillText, serviceId === s.id && styles.pillTextActive]}>
                {s.name} (₦{Number(s.price).toLocaleString()})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-02-20" />

        <Text style={styles.label}>Time (HH:MM)</Text>
        <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="10:00" />

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

        <TouchableOpacity style={[styles.button, creating && styles.buttonDisabled]} onPress={createBooking} disabled={creating}>
          <Text style={styles.buttonText}>{creating ? 'Creating…' : 'Create booking'}</Text>
        </TouchableOpacity>

        {selectedService ? (
          <Text style={styles.hint}>
            Selected: {selectedService.name} • ₦{Number(selectedService.price).toLocaleString()} • {selectedService.duration} mins
          </Text>
        ) : null}
      </View>

      {created ? (
        <View style={styles.card}>
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
            <TouchableOpacity style={[styles.buttonSmall]} onPress={goToTrack}>
              <Text style={styles.buttonText}>Track booking</Text>
            </TouchableOpacity>
          </View>

          {paymentMethod === 'Credit Card' ? (
            <>
              <Text style={[styles.hint, { marginTop: 12 }]}>
                Pay online (opens in browser):
              </Text>
              <View style={styles.rowWrap}>
                <TouchableOpacity
                  style={[styles.buttonSmall, !(paystackStatus?.configured) && styles.buttonDisabled]}
                  onPress={payWithPaystack}
                  disabled={!paystackStatus?.configured}
                >
                  <Text style={styles.buttonText}>Paystack</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.buttonSmall, !(monnifyStatus?.configured) && styles.buttonDisabled]}
                  onPress={payWithMonnify}
                  disabled={!monnifyStatus?.configured}
                >
                  <Text style={styles.buttonText}>Monnify</Text>
                </TouchableOpacity>
              </View>
              {paystackStatus && !paystackStatus.configured ? (
                <Text style={styles.hint}>{paystackStatus.message}</Text>
              ) : null}
              {monnifyStatus && !monnifyStatus.configured ? (
                <Text style={styles.hint}>{monnifyStatus.message}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 36
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  h1: {
    fontSize: 22,
    fontWeight: '700'
  },
  h2: {
    fontSize: 18,
    fontWeight: '700'
  },
  h3: {
    fontSize: 16,
    fontWeight: '700'
  },
  sub: {
    marginTop: 6,
    color: '#555'
  },
  card: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee'
  },
  cardInner: {
    backgroundColor: '#faf7ef',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1e5ca'
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderColor: '#e3e3e3',
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
    borderColor: '#ddd',
    backgroundColor: '#fff'
  },
  pillActive: {
    borderColor: '#b78a2a',
    backgroundColor: '#fff7e6'
  },
  pillText: {
    color: '#333'
  },
  pillTextActive: {
    color: '#7a5b14',
    fontWeight: '700'
  },
  button: {
    marginTop: 14,
    backgroundColor: '#b78a2a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  buttonSmall: {
    backgroundColor: '#b78a2a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700'
  },
  hint: {
    marginTop: 10,
    color: '#666'
  },
  mono: {
    marginTop: 6,
    fontFamily: 'monospace'
  }
});
