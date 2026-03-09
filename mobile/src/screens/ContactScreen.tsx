import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { useNavigation } from '@react-navigation/native';

import { useThemePrefs } from '../theme';
import { getMobilePalette, MOBILE_MOTION, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../lib/haptics';

// Contact information
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
  { level: 'Normal', eta: 'Within 24 hours' },
  { level: 'Priority', eta: 'Within 4-8 hours' },
  { level: 'Urgent', eta: 'Same day handling' }
];

export default function ContactScreen() {
  const navigation = useNavigation<any>();
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
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
    primary: { color: palette.primary },
    primarySoft: { backgroundColor: palette.primarySoft },
    input: { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
    hero: { backgroundColor: isDark ? '#283247' : '#384a72', borderColor: isDark ? '#516287' : '#5a6f99' }
  };

  const generateSupportTicketRef = () => {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CSR-${datePart}-${randomPart}`;
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

  const handleSendMessage = () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      triggerWarningHaptic();
      return;
    }

    triggerLightHaptic();
    setSending(true);
    const newTicketRef = generateSupportTicketRef();
    // In production, this would send to an API
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTicketRef(newTicketRef);
      triggerSuccessHaptic();
      setFormData({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setSent(false), 3000);
    }, 1500);
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
      {/* Header */}
      <Animated.View style={[styles.header, themed.hero, cardIn(10)]}>
        <View style={styles.headerGlowOne} />
        <View style={styles.headerGlowTwo} />
        <Text style={styles.headerTitle}>Contact Us</Text>
        <Text style={styles.headerSubtitle}>Get in touch with us</Text>
      </Animated.View>

      <Animated.View style={cardIn(12)}>
        <TouchableOpacity activeOpacity={0.9} style={styles.whatsAppCta} onPress={handleWhatsApp}>
          <Ionicons name="logo-whatsapp" size={22} color="#fff" />
          <Text style={styles.whatsAppCtaText}>Start WhatsApp Chat</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Contact Cards */}
      <Animated.View style={[styles.section, cardIn(15)]}>
        <View style={styles.quickContactGrid}>
          <TouchableOpacity activeOpacity={0.88} style={[styles.quickContactCard, themed.card]} onPress={handleCall}>
            <View style={[styles.quickContactIcon, { backgroundColor: '#edf4ef' }]}>
              <Ionicons name="call" size={24} color="#2e6a4a" />
            </View>
            <Text style={[styles.quickContactLabel, themed.textMuted]}>Call</Text>
            <Text style={[styles.quickContactValue, themed.text]}>{CONTACT_INFO.phone}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.88} style={[styles.quickContactCard, themed.card]} onPress={handleWhatsApp}>
            <View style={[styles.quickContactIcon, { backgroundColor: '#edf4ef' }]}>
              <Ionicons name="logo-whatsapp" size={24} color={palette.success} />
            </View>
            <Text style={[styles.quickContactLabel, themed.textMuted]}>WhatsApp</Text>
            <Text style={[styles.quickContactValue, themed.text]}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.88} style={[styles.quickContactCard, themed.card]} onPress={handleEmail}>
            <View style={[styles.quickContactIcon, { backgroundColor: '#eef1f8' }]}>
              <Ionicons name="mail" size={24} color={palette.primary} />
            </View>
            <Text style={[styles.quickContactLabel, themed.textMuted]}>Email</Text>
            <Text style={[styles.quickContactValue, themed.text]} numberOfLines={1}>{CONTACT_INFO.email}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.88} style={[styles.quickContactCard, themed.card]} onPress={handleOpenMap}>
            <View style={[styles.quickContactIcon, { backgroundColor: '#f5f0eb' }]}>
              <Ionicons name="location" size={24} color={palette.warm} />
            </View>
            <Text style={[styles.quickContactLabel, themed.textMuted]}>Location</Text>
            <Text style={[styles.quickContactValue, themed.text]} numberOfLines={1}>{CONTACT_INFO.address}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Business Hours */}
      <Animated.View style={[styles.section, themed.cardElevated, cardIn(20)]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time" size={20} color={palette.primary} />
          <Text style={[styles.sectionTitle, themed.text]}>Business Hours</Text>
        </View>
        <View style={styles.hoursList}>
          {CONTACT_INFO.hours.map((item, index) => (
            <View key={index} style={[styles.hoursRow, index !== CONTACT_INFO.hours.length - 1 && styles.hoursRowBorder]}>
              <Text style={[styles.hoursDay, themed.text]}>{item.day}</Text>
              <Text style={[styles.hoursTime, themed.textMuted]}>{item.time}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Social Media */}
      <Animated.View style={[styles.section, themed.cardElevated, cardIn(25)]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="share-social" size={20} color={palette.primary} />
          <Text style={[styles.sectionTitle, themed.text]}>Follow Us</Text>
        </View>
        <View style={styles.socialRow}>
          <TouchableOpacity 
            style={[styles.socialButton, themed.cardMuted]} 
            activeOpacity={0.88}
            onPress={() => {
              triggerLightHaptic();
              Linking.openURL(`https://instagram.com/${CONTACT_INFO.social.instagram.replace('@', '')}`);
            }}
          >
            <Ionicons name="logo-instagram" size={24} color="#8f5c77" />
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
            <Ionicons name="logo-facebook" size={24} color="#4a6e99" />
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
            <Ionicons name="logo-twitter" size={24} color="#5f85a8" />
            <Text style={[styles.socialText, themed.text]}>{CONTACT_INFO.social.twitter}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Customer Care Desk */}
      <Animated.View style={[styles.section, themed.cardElevated, cardIn(28)]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="headset" size={20} color={palette.primary} />
          <Text style={[styles.sectionTitle, themed.text]}>Customer Care Desk</Text>
        </View>

        <Text style={[styles.careIntro, themed.textMuted]}>
          Professional support for bookings, payments, complaints, and follow-up care.
        </Text>

        <View style={styles.careSlaWrap}>
          {CUSTOMER_CARE_STANDARDS.map((item) => (
            <View key={item.level} style={[styles.careSlaChip, themed.cardMuted]}>
              <Text style={[styles.careSlaLevel, themed.text]}>{item.level}</Text>
              <Text style={[styles.careSlaEta, themed.textMuted]}>{item.eta}</Text>
            </View>
          ))}
        </View>

        <View style={styles.careActionsRow}>
          <TouchableOpacity activeOpacity={0.88} style={[styles.careActionBtn, styles.careActionBtnPrimary]} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={styles.careActionTextPrimary}>Priority WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.88} style={[styles.careActionBtn, themed.cardMuted]} onPress={handleCall}>
            <Ionicons name="call-outline" size={16} color={palette.primary} />
            <Text style={[styles.careActionTextMuted, themed.text]}>Request Callback</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.88} style={[styles.careActionBtn, themed.cardMuted]} onPress={handleEmail}>
            <Ionicons name="mail-outline" size={16} color={palette.primary} />
            <Text style={[styles.careActionTextMuted, themed.text]}>Email Support</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Send Message Form */}
      <Animated.View style={[styles.section, themed.cardElevated, cardIn(30)]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="chatbubbles" size={20} color={palette.primary} />
          <Text style={[styles.sectionTitle, themed.text]}>Send Us a Message</Text>
        </View>

        {sent ? (
          <View style={[styles.successMessage, { backgroundColor: '#edf4ef' }]}>
            <View style={styles.successInner}>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={24} color="#2e6a4a" />
                <Text style={[styles.successText, { color: '#2e6a4a' }]}>Message sent successfully!</Text>
              </View>
              {!!ticketRef ? (
                <Text style={styles.ticketRefText}>Support Ticket: {ticketRef}</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.inputLabel, themed.text]}>Name *</Text>
            <TextInput
              style={[styles.input, themed.input]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Your name"
              placeholderTextColor={palette.textMuted}
            />

            <Text style={[styles.inputLabel, themed.text]}>Email *</Text>
            <TextInput
              style={[styles.input, themed.input]}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="your@email.com"
              placeholderTextColor={palette.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, themed.text]}>Phone</Text>
            <TextInput
              style={[styles.input, themed.input]}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="Your phone number"
              placeholderTextColor={palette.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, themed.text]}>Message *</Text>
            <TextInput
              style={[styles.input, themed.input, styles.textArea]}
              value={formData.message}
              onChangeText={(text) => setFormData({ ...formData, message: text })}
              placeholder="How can we help you?"
              placeholderTextColor={palette.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.submitButton, 
                { backgroundColor: palette.primary },
                (!formData.name.trim() || !formData.email.trim() || !formData.message.trim() || sending) && styles.submitButtonDisabled
              ]}
              activeOpacity={0.86}
              onPress={handleSendMessage}
              disabled={!formData.name.trim() || !formData.email.trim() || !formData.message.trim() || sending}
            >
              <Text style={styles.submitButtonText}>
                {sending ? 'Sending...' : 'Send Message'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Website Link */}
      <Animated.View style={[styles.section, cardIn(35)]}>
        <TouchableOpacity activeOpacity={0.88} style={[styles.websiteButton, themed.card]} onPress={handleOpenWebsite}>
          <Ionicons name="globe" size={24} color={palette.primary} />
          <Text style={[styles.websiteText, themed.text]}>Visit our website</Text>
          <Ionicons name="arrow-forward" size={20} color={palette.textMuted} />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
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
    backgroundColor: '#f7f6ff'
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
  headerTitle: {
    fontSize: MOBILE_TYPE.title,
    fontWeight: '900',
    color: '#ffffff'
  },
  headerSubtitle: {
    fontSize: MOBILE_TYPE.body,
    color: '#efe8ff',
    marginTop: 2
  },
  whatsAppCta: {
    marginBottom: MOBILE_SPACE.lg,
    backgroundColor: '#248f5a',
    borderRadius: MOBILE_SHAPE.controlRadius,
    paddingVertical: MOBILE_SPACE.md,
    paddingHorizontal: MOBILE_SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: MOBILE_SPACE.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    shadowColor: '#1d5a3b',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3
  },
  whatsAppCtaText: {
    color: '#fff',
    fontSize: MOBILE_TYPE.body,
    fontWeight: '900'
  },
  section: {
    marginBottom: MOBILE_SPACE.lg,
    borderRadius: MOBILE_SHAPE.cardRadius,
    padding: MOBILE_SPACE.lg,
    borderWidth: 1,
    shadowColor: '#160a2a',
    shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4
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
  quickContactCard: {
    width: '47%',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.lg,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#1a0f33',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  quickContactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MOBILE_SPACE.sm
  },
  quickContactLabel: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '600'
  },
  quickContactValue: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center'
  },
  hoursList: {
    marginTop: MOBILE_SPACE.sm
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: MOBILE_SPACE.md
  },
  hoursRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e6dcff'
  },
  hoursDay: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '600'
  },
  hoursTime: {
    fontSize: MOBILE_TYPE.body
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.md
  },
  socialButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOBILE_SPACE.sm,
    padding: MOBILE_SPACE.md,
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    shadowColor: '#1a0f33',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1
  },
  socialText: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '600'
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
  careSlaChip: {
    flex: 1,
    minWidth: '30%',
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    paddingVertical: MOBILE_SPACE.sm,
    paddingHorizontal: MOBILE_SPACE.md
  },
  careSlaLevel: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  },
  careSlaEta: {
    fontSize: MOBILE_TYPE.caption,
    marginTop: 2
  },
  careActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.md,
    marginTop: MOBILE_SPACE.md
  },
  careActionBtn: {
    flexGrow: 1,
    minWidth: '30%',
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    borderColor: '#d9def1',
    paddingVertical: MOBILE_SPACE.md,
    paddingHorizontal: MOBILE_SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  careActionBtnPrimary: {
    backgroundColor: '#248f5a',
    borderColor: '#1f7148'
  },
  careActionTextPrimary: {
    color: '#fff',
    fontWeight: '800',
    fontSize: MOBILE_TYPE.caption
  },
  careActionTextMuted: {
    fontWeight: '700',
    fontSize: MOBILE_TYPE.caption
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
    height: 100,
    paddingTop: MOBILE_SPACE.md
  },
  submitButton: {
    marginTop: MOBILE_SPACE.xl,
    paddingVertical: MOBILE_SPACE.lg,
    borderRadius: MOBILE_SHAPE.controlRadius,
    alignItems: 'center',
    shadowColor: '#3d1d7a',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
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
  successMessage: {
    padding: MOBILE_SPACE.lg,
    borderRadius: MOBILE_SHAPE.controlRadius
  },
  successInner: {
    width: '100%'
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: MOBILE_SPACE.sm
  },
  successText: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700'
  },
  ticketRefText: {
    marginTop: MOBILE_SPACE.sm,
    textAlign: 'center',
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800',
    color: '#2e6a4a'
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: MOBILE_SPACE.lg,
    borderWidth: 1,
    borderRadius: MOBILE_SHAPE.controlRadius,
    shadowColor: '#1a0f33',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
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
    backgroundColor: '#7c46e8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: MOBILE_SHAPE.chipRadius,
    shadowColor: '#2a0b57',
    shadowOpacity: 0.24,
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

