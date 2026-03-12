import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ApiError, apiPostJson } from '../lib/api';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../lib/haptics';
import { useThemePrefs } from '../theme';
import { getMobilePalette, MOBILE_MOTION, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';

const CONTACT_INFO = {
  phone: '07036939125',
  whatsapp: '07036939125',
  email: 'okontaysm@gmail.com',
  address: 'Lagos, Nigeria',
  website: 'https://ceosaloon.com',
  social: {
    instagram: '@ceosaloon',
    facebook: 'CEO Unisex Salon',
    twitter: '@ceosaloon'
  },
  hours: [
    { day: 'Monday - Friday', time: '8:00 AM - 8:00 PM' },
    { day: 'Saturday', time: '9:00 AM - 6:00 PM' },
    { day: 'Sunday', time: '10:00 AM - 4:00 PM' }
  ]
};

const CUSTOMER_CARE_STANDARDS = [
  { level: 'General', eta: 'Within 24 hours' },
  { level: 'Priority', eta: 'Within 4 to 8 hours' },
  { level: 'Urgent', eta: 'Same day handling' }
];

type MessageResponse = {
  message: string;
  data: {
    id: string;
    subject: string;
  };
};

export default function ContactScreen() {
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [ticketRef, setTicketRef] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const screenEntry = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(screenEntry, {
      toValue: 1,
      duration: MOBILE_MOTION.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [screenEntry]);

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

  const themed = {
    container: { backgroundColor: palette.bg },
    card: { backgroundColor: palette.card, borderColor: palette.border },
    cardMuted: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    cardElevated: { backgroundColor: palette.cardElevated, borderColor: palette.border },
    text: { color: palette.text },
    textMuted: { color: palette.textMuted },
    input: { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
    hero: { backgroundColor: isDark ? '#172744' : '#2d477f', borderColor: isDark ? '#314b7e' : '#4b67a4' },
    heroSubtle: { color: '#d9e5ff' },
    successSoft: { backgroundColor: isDark ? '#143428' : '#e9f7ef', borderColor: isDark ? '#266946' : '#b7e2cb' }
  };

  const canSend = Boolean(
    formData.name.trim() &&
      formData.email.trim() &&
      formData.subject.trim() &&
      formData.message.trim()
  );

  const updateField = (key: keyof typeof formData, value: string) => {
    setSent(false);
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCall = () => {
    triggerLightHaptic();
    Linking.openURL(`tel:${CONTACT_INFO.phone}`);
  };

  const handleWhatsApp = () => {
    triggerLightHaptic();
    const digits = CONTACT_INFO.whatsapp.replace(/\D/g, '');
    const international = digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
    Linking.openURL(`https://wa.me/${international}`);
  };

  const handleEmail = () => {
    triggerLightHaptic();
    Linking.openURL(`mailto:${CONTACT_INFO.email}`);
  };

  const handleOpenMap = () => {
    triggerLightHaptic();
    const query = encodeURIComponent(CONTACT_INFO.address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const handleOpenWebsite = () => {
    triggerLightHaptic();
    Linking.openURL(CONTACT_INFO.website);
  };

  const handleSendMessage = async () => {
    if (!canSend) {
      triggerWarningHaptic();
      Alert.alert('Missing details', 'Enter your name, email, subject, and message.');
      return;
    }

    setSending(true);
    triggerLightHaptic();

    try {
      const messageBody = formData.phone.trim()
        ? `Phone: ${formData.phone.trim()}\n\n${formData.message.trim()}`
        : formData.message.trim();

      const response = await apiPostJson<MessageResponse>('/api/messages', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject.trim(),
        message: messageBody,
        reportType: 'general_message'
      });

      setSending(false);
      setSent(true);
      setTicketRef(String(response?.data?.id || '').slice(0, 8).toUpperCase());
      triggerSuccessHaptic();
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      setSending(false);
      const message =
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Failed to send message';
      Alert.alert('Message not sent', message);
    }
  };

  const handleScrollPosition = (y: number) => {
    const shouldShow = y > 320;
    setShowBackToTop((prev) => (prev === shouldShow ? prev : shouldShow));
  };

  const scrollToTop = () => {
    triggerLightHaptic();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={styles.screenWrap}>
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, themed.container]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => handleScrollPosition(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <Animated.View style={[styles.header, themed.hero, cardIn(10)]}>
          <View style={styles.headerGlowOne} />
          <View style={styles.headerGlowTwo} />
          <Text style={styles.headerKicker}>CONTACT</Text>
          <Text style={styles.headerTitle}>Reach the salon team in the way that fits your schedule.</Text>
          <Text style={[styles.headerSubtitle, themed.heroSubtle]}>
            Call, WhatsApp, email, or send a structured message that saves directly to the backend.
          </Text>
        </Animated.View>

        <Animated.View style={cardIn(14)}>
          <TouchableOpacity activeOpacity={0.9} style={[styles.primaryCta, { backgroundColor: palette.success }]} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.primaryCtaText}>Start WhatsApp chat</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.section, cardIn(18)]}>
          <View style={styles.quickContactGrid}>
            <TouchableOpacity activeOpacity={0.9} style={[styles.quickCard, themed.card]} onPress={handleCall}>
              <View style={[styles.quickIcon, { backgroundColor: isDark ? '#1a3140' : '#edf4fb' }]}>
                <Ionicons name="call-outline" size={22} color={palette.secondary} />
              </View>
              <Text style={[styles.quickLabel, themed.textMuted]}>Call</Text>
              <Text style={[styles.quickValue, themed.text]}>{CONTACT_INFO.phone}</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} style={[styles.quickCard, themed.card]} onPress={handleWhatsApp}>
              <View style={[styles.quickIcon, { backgroundColor: isDark ? '#143428' : '#e9f7ef' }]}>
                <Ionicons name="logo-whatsapp" size={22} color={palette.success} />
              </View>
              <Text style={[styles.quickLabel, themed.textMuted]}>WhatsApp</Text>
              <Text style={[styles.quickValue, themed.text]}>Priority support</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} style={[styles.quickCard, themed.card]} onPress={handleEmail}>
              <View style={[styles.quickIcon, { backgroundColor: isDark ? '#1c2742' : '#edf0ff' }]}>
                <Ionicons name="mail-outline" size={22} color={palette.primary} />
              </View>
              <Text style={[styles.quickLabel, themed.textMuted]}>Email</Text>
              <Text style={[styles.quickValue, themed.text]} numberOfLines={1}>
                {CONTACT_INFO.email}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} style={[styles.quickCard, themed.card]} onPress={handleOpenMap}>
              <View style={[styles.quickIcon, { backgroundColor: isDark ? '#3a2817' : '#fcf1e5' }]}>
                <Ionicons name="location-outline" size={22} color={palette.warm} />
              </View>
              <Text style={[styles.quickLabel, themed.textMuted]}>Location</Text>
              <Text style={[styles.quickValue, themed.text]} numberOfLines={1}>
                {CONTACT_INFO.address}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, themed.cardElevated, cardIn(22)]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={18} color={palette.primary} />
            <Text style={[styles.sectionTitle, themed.text]}>Business Hours</Text>
          </View>
          {CONTACT_INFO.hours.map((item, index) => (
            <View
              key={item.day}
              style={[styles.hoursRow, index !== CONTACT_INFO.hours.length - 1 ? { borderBottomWidth: 1, borderBottomColor: palette.border } : null]}
            >
              <Text style={[styles.hoursDay, themed.text]}>{item.day}</Text>
              <Text style={[styles.hoursTime, themed.textMuted]}>{item.time}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.section, themed.cardElevated, cardIn(26)]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="headset-outline" size={18} color={palette.primary} />
            <Text style={[styles.sectionTitle, themed.text]}>Customer Care</Text>
          </View>

          <Text style={[styles.careIntro, themed.textMuted]}>
            Use the message form for booking questions, product issues, payment clarifications, or follow-up support.
          </Text>

          <View style={styles.careSlaWrap}>
            {CUSTOMER_CARE_STANDARDS.map((item) => (
              <View key={item.level} style={[styles.careChip, themed.cardMuted]}>
                <Text style={[styles.careChipTitle, themed.text]}>{item.level}</Text>
                <Text style={[styles.careChipMeta, themed.textMuted]}>{item.eta}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, themed.cardElevated, cardIn(30)]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubbles-outline" size={18} color={palette.primary} />
            <Text style={[styles.sectionTitle, themed.text]}>Send a Message</Text>
          </View>

          {sent ? (
            <View style={[styles.successBox, themed.successSoft]}>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={22} color={palette.success} />
                <Text style={[styles.successTitle, { color: palette.success }]}>Message saved successfully</Text>
              </View>
              <Text style={[styles.successText, themed.text]}>
                Your message is now stored in the backend and available to the admin team.
              </Text>
              {ticketRef ? <Text style={[styles.successMeta, themed.textMuted]}>Reference: {ticketRef}</Text> : null}
            </View>
          ) : null}

          <View style={styles.form}>
            <Text style={[styles.inputLabel, themed.text]}>Name *</Text>
            <TextInput
              style={[styles.input, themed.input]}
              value={formData.name}
              onChangeText={(text) => updateField('name', text)}
              placeholder="Your full name"
              placeholderTextColor={palette.textMuted}
            />

            <Text style={[styles.inputLabel, themed.text]}>Email *</Text>
            <TextInput
              style={[styles.input, themed.input]}
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              placeholder="your@email.com"
              placeholderTextColor={palette.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, themed.text]}>Phone</Text>
            <TextInput
              style={[styles.input, themed.input]}
              value={formData.phone}
              onChangeText={(text) => updateField('phone', text)}
              placeholder="Optional phone number"
              placeholderTextColor={palette.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, themed.text]}>Subject *</Text>
            <TextInput
              style={[styles.input, themed.input]}
              value={formData.subject}
              onChangeText={(text) => updateField('subject', text)}
              placeholder="What do you need help with?"
              placeholderTextColor={palette.textMuted}
            />

            <Text style={[styles.inputLabel, themed.text]}>Message *</Text>
            <TextInput
              style={[styles.input, themed.input, styles.textArea]}
              value={formData.message}
              onChangeText={(text) => updateField('message', text)}
              placeholder="Describe your request clearly"
              placeholderTextColor={palette.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: palette.primary },
                (!canSend || sending) && styles.submitButtonDisabled
              ]}
              activeOpacity={0.88}
              onPress={handleSendMessage}
              disabled={!canSend || sending}
            >
              <Text style={styles.submitButtonText}>{sending ? 'Sending...' : 'Send message'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, themed.cardElevated, cardIn(34)]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="share-social-outline" size={18} color={palette.primary} />
            <Text style={[styles.sectionTitle, themed.text]}>Follow the Brand</Text>
          </View>
          <View style={styles.socialGrid}>
            <TouchableOpacity
              style={[styles.socialButton, themed.cardMuted]}
              activeOpacity={0.88}
              onPress={() => {
                triggerLightHaptic();
                Linking.openURL(`https://instagram.com/${CONTACT_INFO.social.instagram.replace('@', '')}`);
              }}
            >
              <Ionicons name="logo-instagram" size={20} color="#d5547c" />
              <Text style={[styles.socialText, themed.text]}>{CONTACT_INFO.social.instagram}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialButton, themed.cardMuted]}
              activeOpacity={0.88}
              onPress={() => {
                triggerLightHaptic();
                Linking.openURL(`https://facebook.com/${CONTACT_INFO.social.facebook.replace(/ /g, '')}`);
              }}
            >
              <Ionicons name="logo-facebook" size={20} color="#2f6fda" />
              <Text style={[styles.socialText, themed.text]}>{CONTACT_INFO.social.facebook}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialButton, themed.cardMuted]}
              activeOpacity={0.88}
              onPress={() => {
                triggerLightHaptic();
                Linking.openURL(`https://twitter.com/${CONTACT_INFO.social.twitter.replace('@', '')}`);
              }}
            >
              <Ionicons name="logo-twitter" size={20} color="#4ba3da" />
              <Text style={[styles.socialText, themed.text]}>{CONTACT_INFO.social.twitter}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, cardIn(38)]}>
          <TouchableOpacity activeOpacity={0.88} style={[styles.websiteButton, themed.card]} onPress={handleOpenWebsite}>
            <Ionicons name="globe-outline" size={22} color={palette.primary} />
            <Text style={[styles.websiteText, themed.text]}>Visit our website</Text>
            <Ionicons name="arrow-forward" size={18} color={palette.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

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
    flex: 1
  },
  contentContainer: {
    padding: MOBILE_SPACE.lg
  },
  header: {
    marginBottom: MOBILE_SPACE.lg,
    borderRadius: MOBILE_SHAPE.cardRadius,
    borderWidth: 1,
    paddingHorizontal: MOBILE_SPACE.lg,
    paddingVertical: MOBILE_SPACE.xl,
    overflow: 'hidden'
  },
  headerGlowOne: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 999,
    top: -55,
    right: -28,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  headerGlowTwo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 999,
    bottom: -80,
    left: -58,
    backgroundColor: 'rgba(176,198,236,0.14)'
  },
  headerKicker: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800',
    color: '#d9e5ff',
    letterSpacing: 1,
    marginBottom: 6
  },
  headerTitle: {
    fontSize: MOBILE_TYPE.title,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 30
  },
  headerSubtitle: {
    fontSize: MOBILE_TYPE.body,
    marginTop: 6,
    lineHeight: 20
  },
  primaryCta: {
    marginBottom: MOBILE_SPACE.lg,
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: MOBILE_SPACE.md,
    paddingHorizontal: MOBILE_SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: MOBILE_SPACE.sm,
    shadowColor: '#0c1a12',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3
  },
  primaryCtaText: {
    color: '#fff',
    fontSize: MOBILE_TYPE.body,
    fontWeight: '900'
  },
  section: {
    marginBottom: MOBILE_SPACE.lg
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOBILE_SPACE.sm,
    marginBottom: MOBILE_SPACE.md
  },
  sectionTitle: {
    fontSize: MOBILE_TYPE.heading,
    fontWeight: '800'
  },
  quickContactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.md
  },
  quickCard: {
    width: '47%',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.lg,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#0a1222',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MOBILE_SPACE.sm
  },
  quickLabel: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '700'
  },
  quickValue: {
    marginTop: 4,
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    textAlign: 'center'
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: MOBILE_SPACE.md
  },
  hoursDay: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700'
  },
  hoursTime: {
    fontSize: MOBILE_TYPE.body
  },
  careIntro: {
    fontSize: MOBILE_TYPE.body,
    lineHeight: 21,
    marginBottom: MOBILE_SPACE.md
  },
  careSlaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.sm
  },
  careChip: {
    flex: 1,
    minWidth: '30%',
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    paddingVertical: MOBILE_SPACE.sm,
    paddingHorizontal: MOBILE_SPACE.md
  },
  careChipTitle: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  },
  careChipMeta: {
    fontSize: MOBILE_TYPE.caption,
    marginTop: 2
  },
  successBox: {
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    padding: MOBILE_SPACE.lg,
    marginBottom: MOBILE_SPACE.md
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOBILE_SPACE.sm
  },
  successTitle: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '800'
  },
  successText: {
    marginTop: 8,
    fontSize: MOBILE_TYPE.caption,
    lineHeight: 18
  },
  successMeta: {
    marginTop: 8,
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  },
  form: {
    marginTop: MOBILE_SPACE.sm
  },
  inputLabel: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    marginTop: MOBILE_SPACE.md,
    marginBottom: MOBILE_SPACE.xs
  },
  input: {
    borderWidth: 1,
    borderRadius: MOBILE_SHAPE.inputRadius,
    paddingHorizontal: MOBILE_SPACE.lg,
    paddingVertical: MOBILE_SPACE.md,
    fontSize: MOBILE_TYPE.body
  },
  textArea: {
    minHeight: 112,
    paddingTop: MOBILE_SPACE.md
  },
  submitButton: {
    marginTop: MOBILE_SPACE.xl,
    paddingVertical: MOBILE_SPACE.lg,
    borderRadius: MOBILE_SHAPE.controlRadius,
    alignItems: 'center',
    shadowColor: '#15244a',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3
  },
  submitButtonDisabled: {
    opacity: 0.5
  },
  submitButtonText: {
    color: '#fff',
    fontSize: MOBILE_TYPE.body,
    fontWeight: '800'
  },
  socialGrid: {
    gap: MOBILE_SPACE.sm
  },
  socialButton: {
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    padding: MOBILE_SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOBILE_SPACE.sm
  },
  socialText: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700'
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: MOBILE_SPACE.lg,
    borderWidth: 1,
    borderRadius: MOBILE_SHAPE.controlRadius
  },
  websiteText: {
    flex: 1,
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    marginLeft: MOBILE_SPACE.md
  },
  bottomSpacer: {
    height: MOBILE_SPACE.xxl
  },
  backToTopButton: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: MOBILE_SHAPE.chipRadius,
    shadowColor: '#0b1120',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4
  },
  backToTopText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: MOBILE_TYPE.caption
  }
});
