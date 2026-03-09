import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemePrefs } from '../theme';
import { getMobilePalette, MOBILE_MOTION, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';
import { resolveImageUri } from '../lib/images';
import { triggerLightHaptic } from '../lib/haptics';

// Team members data - in production these would come from an API
const TEAM_MEMBERS = [
  { 
    id: '1', 
    name: 'Okonta Victor', 
    role: 'CEO / Founder', 
    bio: 'Visionary leader with 15+ years in the beauty industry.',
    image: 'images/ysmceo.jpeg',
    phone: '+2348000000001',
    whatsapp: '+2348000000001'
  },
  { 
    id: '2', 
    name: 'Okonta Lizzy', 
    role: 'CEO / Co-Founder', 
    bio: 'Creative director bringing innovation to every style.',
    image: 'images/ysmwife.jpeg',
    phone: '+2348000000002',
    whatsapp: '+2348000000002'
  },
  { 
    id: '3', 
    name: 'Sarah Johnson', 
    role: 'Senior Stylist', 
    bio: 'Expert in hair coloring and creative styling techniques.',
    image: 'images/female stylst 3.jpeg',
    phone: '+2348000000003',
    whatsapp: '+2348000000003'
  },
  { 
    id: '4', 
    name: 'Michael Chen', 
    role: 'Color Specialist', 
    bio: 'Master colorist specializing in vibrant transformations.',
    image: 'images/male baber sytlist.jpeg',
    phone: '+2348000000004',
    whatsapp: '+2348000000004'
  },
  { 
    id: '5', 
    name: 'Grace Williams', 
    role: 'Nail Artist', 
    bio: 'Precision nail art and spa treatments expert.',
    image: 'images/female sytlsit 1.jpeg',
    phone: '+2348000000005',
    whatsapp: '+2348000000005'
  },
  { 
    id: '6', 
    name: 'David Brown', 
    role: 'Barber', 
    bio: 'Classic cuts and modern grooming specialist.',
    image: 'images/male baber sytlist.jpeg',
    phone: '+2348000000006',
    whatsapp: '+2348000000006'
  },
  { 
    id: '7', 
    name: 'Emma Davis', 
    role: 'Makeup Artist', 
    bio: 'Bridal and event makeup artistry professional.',
    image: 'images/female stylsit 2.jpeg',
    phone: '+2348000000007',
    whatsapp: '+2348000000007'
  },
  { 
    id: '8', 
    name: 'James Wilson', 
    role: 'Spa Therapist', 
    bio: 'Relaxation and therapeutic massage expert.',
    image: 'images/male baber sytlist.jpeg',
    phone: '+2348000000008',
    whatsapp: '+2348000000008'
  },
];

type TeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
  phone: string;
  whatsapp: string;
};

export default function TeamScreen() {
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Record<string, true>>({});
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
    cardElevated: { backgroundColor: palette.cardElevated, borderColor: palette.border },
    cardMuted: { backgroundColor: palette.cardMuted, borderColor: palette.border },
    text: { color: palette.text },
    textMuted: { color: palette.textMuted },
    primary: { color: palette.primary },
    primarySoft: { backgroundColor: palette.primarySoft },
    hero: { backgroundColor: isDark ? '#283247' : '#384a72', borderColor: isDark ? '#516287' : '#5a6f99' }
  };

  const handleCall = (phone: string) => {
    triggerLightHaptic();
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (whatsapp: string) => {
    triggerLightHaptic();
    Linking.openURL(`https://wa.me/${whatsapp.replace(/^\+/, '')}`);
  };

  const renderTeamMember = ({ item, index }: { item: TeamMember; index: number }) => (
    <Animated.View style={[styles.teamCardWrapper, cardIn(index * 15)]}>
      <Pressable
        style={({ pressed }) => [styles.teamCard, themed.card, pressed && styles.pressed]}
        onPress={() => {
          triggerLightHaptic();
          setSelectedMember(item);
        }}
      >
        {resolveImageUri(item.image) && !failedImageIds[item.id] ? (
          <Image
            source={{ uri: resolveImageUri(item.image)! }}
            style={styles.memberAvatarImage}
            resizeMode="cover"
            onError={() => {
              setFailedImageIds((prev) => ({ ...prev, [item.id]: true }));
            }}
          />
        ) : (
          <View style={[styles.memberAvatar, themed.primarySoft]}>
            <Ionicons name="person" size={36} color={palette.primary} />
          </View>
        )}
        <Text style={[styles.memberName, themed.text]}>{item.name}</Text>
        <Text style={[styles.memberRole, themed.primary]}>{item.role}</Text>
        <Text style={[styles.memberBio, themed.textMuted]} numberOfLines={2}>{item.bio}</Text>
        
        <View style={styles.memberActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: palette.success }]}
            activeOpacity={0.88}
            onPress={() => handleWhatsApp(item.whatsapp)}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: palette.primary }]}
            activeOpacity={0.88}
            onPress={() => handleCall(item.phone)}
          >
            <Ionicons name="call" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, themed.container]}>
      {/* Header */}
      <Animated.View style={[styles.header, themed.hero, cardIn(10)]}>
        <View style={styles.headerGlowOne} />
        <View style={styles.headerGlowTwo} />
        <Text style={styles.headerTitle}>Our Team</Text>
        <Text style={styles.headerSubtitle}>Meet our talented professionals</Text>
      </Animated.View>

      {/* Team Grid */}
      <FlatList
        data={TEAM_MEMBERS}
        keyExtractor={(item) => item.id}
        renderItem={renderTeamMember}
        numColumns={2}
        contentContainerStyle={styles.teamGrid}
        showsVerticalScrollIndicator={false}
      />

      {/* Member Detail Modal */}
      {selectedMember && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              triggerLightHaptic();
              setSelectedMember(null);
            }}
          />
          <Animated.View style={[styles.modalCard, themed.cardElevated, cardIn(20)]}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {resolveImageUri(selectedMember.image) && !failedImageIds[selectedMember.id] ? (
                <Image
                  source={{ uri: resolveImageUri(selectedMember.image)! }}
                  style={styles.modalAvatarImage}
                  resizeMode="cover"
                  onError={() => {
                    setFailedImageIds((prev) => ({ ...prev, [selectedMember.id]: true }));
                  }}
                />
              ) : (
                <View style={[styles.modalAvatar, themed.primarySoft]}>
                  <Ionicons name="person" size={48} color={palette.primary} />
                </View>
              )}

              <Text style={[styles.modalName, themed.text]}>{selectedMember.name}</Text>
              <Text style={[styles.modalRole, themed.primary]}>{selectedMember.role}</Text>
              <Text style={[styles.modalBio, themed.textMuted]}>{selectedMember.bio}</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: palette.success }]}
                  activeOpacity={0.86}
                  onPress={() => handleWhatsApp(selectedMember.whatsapp)}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                  <Text style={styles.modalButtonText}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: palette.primary }]}
                  activeOpacity={0.86}
                  onPress={() => handleCall(selectedMember.phone)}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.modalButtonText}>Call</Text>
                </TouchableOpacity>
              </View>

              <Pressable 
                style={[styles.closeButton, themed.cardMuted]} 
                onPress={() => {
                  triggerLightHaptic();
                  setSelectedMember(null);
                }}
              >
                <Ionicons name="close" size={20} color={palette.text} />
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f6ff'
  },
  header: {
    padding: MOBILE_SPACE.lg,
    paddingTop: MOBILE_SPACE.xl,
    borderRadius: MOBILE_SHAPE.cardRadius,
    borderWidth: 1,
    marginHorizontal: MOBILE_SPACE.lg,
    marginTop: MOBILE_SPACE.sm,
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
  teamGrid: {
    padding: MOBILE_SPACE.md,
    paddingTop: MOBILE_SPACE.md
  },
  teamCardWrapper: {
    flex: 1,
    maxWidth: '50%',
    padding: MOBILE_SPACE.sm
  },
  teamCard: {
    borderRadius: MOBILE_SHAPE.cardRadius,
    padding: MOBILE_SPACE.lg,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#160a2a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }]
  },
  memberAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MOBILE_SPACE.md
  },
  memberAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: MOBILE_SPACE.md,
    backgroundColor: '#e6dcff'
  },
  memberName: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '800',
    textAlign: 'center'
  },
  memberRole: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '700',
    marginTop: 2
  },
  memberBio: {
    fontSize: MOBILE_TYPE.micro,
    textAlign: 'center',
    marginTop: MOBILE_SPACE.sm,
    lineHeight: 16
  },
  memberActions: {
    flexDirection: 'row',
    gap: MOBILE_SPACE.sm,
    marginTop: MOBILE_SPACE.md
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#140b28',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalCard: {
    borderTopLeftRadius: MOBILE_SHAPE.cardRadius,
    borderTopRightRadius: MOBILE_SHAPE.cardRadius,
    paddingHorizontal: MOBILE_SPACE.xl,
    paddingTop: MOBILE_SPACE.xl,
    paddingBottom: MOBILE_SPACE.xxxl + 20,
    maxHeight: '88%'
  },
  modalScrollContent: {
    alignItems: 'center'
  },
  modalAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MOBILE_SPACE.lg,
    marginTop: -50
  },
  modalAvatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: MOBILE_SPACE.lg,
    marginTop: -50,
    backgroundColor: '#e6dcff'
  },
  modalName: {
    fontSize: MOBILE_TYPE.heading,
    fontWeight: '900'
  },
  modalRole: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    marginTop: 2
  },
  modalBio: {
    fontSize: MOBILE_TYPE.body,
    textAlign: 'center',
    marginTop: MOBILE_SPACE.md,
    lineHeight: 20
  },
  modalActions: {
    flexDirection: 'row',
    gap: MOBILE_SPACE.md,
    marginTop: MOBILE_SPACE.xl,
    width: '100%'
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: MOBILE_SPACE.md,
    borderRadius: MOBILE_SHAPE.controlRadius,
    gap: MOBILE_SPACE.sm,
    shadowColor: '#160a2a',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: MOBILE_TYPE.body
  },
  closeButton: {
    position: 'absolute',
    top: MOBILE_SPACE.lg,
    right: MOBILE_SPACE.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

