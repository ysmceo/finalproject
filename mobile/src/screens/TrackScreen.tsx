import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';

import { apiGet, ApiError } from '../lib/api';
import { buildApiUrl } from '../config';
import type { TrackResponse } from '../types';

const LAST_BOOKING_ID_KEY = 'ceosalon:lastBookingId';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';

type BankDetails = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  amountDueNow: number;
  bookingId: string;
};

export default function TrackScreen(props: any) {
  const initialBookingId = String(props?.route?.params?.bookingId || '');
  const initialEmail = String(props?.route?.params?.email || '');

  const [bookingId, setBookingId] = useState(initialBookingId);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrackResponse | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    // If params are empty, try to load last booking from storage.
    (async () => {
      if (bookingId && email) return;
      const [lastId, lastEmail] = await Promise.all([
        AsyncStorage.getItem(LAST_BOOKING_ID_KEY),
        AsyncStorage.getItem(LAST_BOOKING_EMAIL_KEY)
      ]);
      if (!bookingId && lastId) setBookingId(lastId);
      if (!email && lastEmail) setEmail(lastEmail);
    })().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canFetch = useMemo(() => {
    return Boolean(bookingId.trim() && email.trim());
  }, [bookingId, email]);

  async function fetchTracking() {
    if (!canFetch) {
      Alert.alert('Missing info', 'Enter your Booking ID and Email.');
      return;
    }
    setLoading(true);
    setData(null);
    setBankDetails(null);
    try {
      const res = await apiGet<TrackResponse>(`/api/bookings/${encodeURIComponent(bookingId.trim())}/track?email=${encodeURIComponent(email.trim())}`);
      setData(res);
      await AsyncStorage.setItem(LAST_BOOKING_ID_KEY, res.booking.id);
      await AsyncStorage.setItem(LAST_BOOKING_EMAIL_KEY, email.trim());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : 'Failed to fetch booking');
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBankDetails() {
    if (!canFetch) return;
    try {
      const details = await apiGet<BankDetails>(`/api/payments/bank/details?bookingId=${encodeURIComponent(bookingId.trim())}&email=${encodeURIComponent(email.trim())}`);
      setBankDetails(details);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load bank details');
    }
  }

  async function uploadReceipt() {
    if (!canFetch) {
      Alert.alert('Missing info', 'Enter your Booking ID and Email first.');
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

      const res = await fetch(buildApiUrl(`/api/bookings/${encodeURIComponent(bookingId.trim())}/upload-receipt`), {
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

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Track your booking</Text>
      <Text style={styles.sub}>Enter your Booking ID and Email to see status + notifications.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Booking ID</Text>
        <TextInput style={styles.input} value={bookingId} onChangeText={setBookingId} placeholder="e.g. 2b4d..." autoCapitalize="none" />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />

        <TouchableOpacity style={[styles.button, (!canFetch || loading) && styles.buttonDisabled]} onPress={fetchTracking} disabled={!canFetch || loading}>
          <Text style={styles.buttonText}>{loading ? 'Loading…' : 'Track booking'}</Text>
        </TouchableOpacity>
      </View>

      {data ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Booking</Text>
          <Text style={styles.mono}>Status: {data.booking.status}</Text>
          <Text style={styles.mono}>Service: {data.booking.serviceName}</Text>
          <Text style={styles.mono}>Date/Time: {data.booking.date} • {data.booking.time}</Text>
          <Text style={styles.mono}>Payment: {data.booking.paymentStatus} ({data.booking.paymentPlan})</Text>
          <Text style={styles.mono}>Due now: ₦{Number(data.booking.amountDueNow || 0).toLocaleString()}</Text>
          <Text style={styles.mono}>Remaining: ₦{Number(data.booking.amountRemaining || 0).toLocaleString()}</Text>
          {data.booking.serviceMode === 'home' ? (
            <Text style={styles.mono}>Home address: {data.booking.homeServiceAddress}</Text>
          ) : null}

          {String(data.booking.paymentMethod || '').trim() === 'Bank Transfer' ? (
            <>
              <View style={styles.rowWrap}>
                <TouchableOpacity style={styles.buttonSmall} onPress={fetchBankDetails}>
                  <Text style={styles.buttonText}>Bank details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonSmall, uploadingReceipt && styles.buttonDisabled]}
                  onPress={uploadReceipt}
                  disabled={uploadingReceipt}
                >
                  <Text style={styles.buttonText}>{uploadingReceipt ? 'Uploading…' : 'Upload receipt'}</Text>
                </TouchableOpacity>
              </View>

              {bankDetails ? (
                <View style={styles.cardInner}>
                  <Text style={styles.h3}>Bank Transfer Details</Text>
                  <Text style={styles.mono}>{bankDetails.bankName}</Text>
                  <Text style={styles.mono}>{bankDetails.accountNumber}</Text>
                  <Text style={styles.mono}>{bankDetails.accountName}</Text>
                  <Text style={styles.mono}>Reference: {bankDetails.reference}</Text>
                  <Text style={styles.mono}>Amount due now: ₦{Number(bankDetails.amountDueNow || 0).toLocaleString()}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {data ? (
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.h2}>Notifications</Text>
          <FlatList
            data={data.notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 10, gap: 10 }}
            renderItem={({ item }) => (
              <View style={styles.note}>
                <Text style={styles.noteMsg}>{item.message}</Text>
                <Text style={styles.noteMeta}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
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
    padding: 16
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
    marginTop: 12,
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
  rowWrap: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center'
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
  mono: {
    marginTop: 6,
    fontFamily: 'monospace'
  },
  note: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff'
  },
  noteMsg: {
    fontSize: 14,
    lineHeight: 18
  },
  noteMeta: {
    marginTop: 6,
    color: '#777',
    fontSize: 12
  }
});
