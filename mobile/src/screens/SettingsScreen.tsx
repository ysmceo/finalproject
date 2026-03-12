import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { triggerLightHaptic, triggerWarningHaptic } from '../lib/haptics';
import { ThemeMode, useThemePrefs } from '../theme';
import { getMobilePalette, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';

const LAST_BOOKING_ID_KEY = 'ceosalon:lastBookingId';
const LAST_BOOKING_EMAIL_KEY = 'ceosalon:lastBookingEmail';
export const ADMIN_TOKEN_KEY = 'ceosalon:adminToken';
export const ADMIN_EMAIL_KEY = 'ceosalon:adminEmail';

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return <Text style={[styles.sectionTitle, { color }]}>{children}</Text>;
}

function Card({
  children,
  backgroundColor,
  borderColor
}: {
  children: React.ReactNode;
  backgroundColor: string;
  borderColor: string;
}) {
  return <View style={[styles.card, { backgroundColor, borderColor }]}>{children}</View>;
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  iconBg,
  iconColor,
  titleColor,
  subtitleColor,
  borderColor,
  right
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  subtitleColor: string;
  borderColor?: string;
  right?: React.ReactNode;
}) {
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: subtitleColor }]}>{subtitle}</Text> : null}
      </View>
      {right || (onPress ? <Ionicons name="chevron-forward" size={18} color={subtitleColor} /> : null)}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          triggerLightHaptic();
          onPress();
        }}
        style={({ pressed }) => [
          styles.row,
          borderColor ? { borderBottomWidth: 1, borderBottomColor: borderColor } : null,
          pressed && styles.rowPressed
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, borderColor ? { borderBottomWidth: 1, borderBottomColor: borderColor } : null]}>
      {content}
    </View>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { mode: themeMode, setMode: setThemeMode, resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  async function openUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open link', 'Please try again.');
    }
  }

  async function clearSavedBooking() {
    Alert.alert('Clear saved booking?', 'This removes the last booking code and email saved on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([LAST_BOOKING_ID_KEY, LAST_BOOKING_EMAIL_KEY]);
            triggerWarningHaptic();
            Alert.alert('Done', 'Saved booking details cleared.');
          } catch {
            Alert.alert('Error', 'Failed to clear saved booking details.');
          }
        }
      }
    ]);
  }

  async function logoutDeviceData() {
    Alert.alert('Clear device session?', 'This clears saved booking and admin data on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const removable = keys.filter((key) => String(key).startsWith('ceosalon:'));
            await AsyncStorage.multiRemove(removable);
            setThemeMode('system');
            triggerWarningHaptic();
            Alert.alert('Cleared', 'Saved app data has been removed from this device.');
          } catch {
            Alert.alert('Error', 'Failed to clear device data.');
          }
        }
      }
    ]);
  }

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { value: 'system', label: 'System', icon: 'contrast-outline' },
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' }
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: isDark ? '#172744' : '#2d477f',
            borderColor: isDark ? '#314b7e' : '#4b67a4'
          }
        ]}
      >
        <View style={styles.heroGlowTop} />
        <View style={styles.heroGlowBottom} />
        <Text style={styles.heroKicker}>MORE</Text>
        <Text style={styles.heroTitle}>Explore more of CEO Salon.</Text>
        <Text style={styles.heroSubtitle}>Gallery, team, support, admin, and appearance settings.</Text>
      </View>

      <SectionTitle color={palette.warm}>Explore</SectionTitle>
      <Card backgroundColor={palette.card} borderColor={palette.border}>
        <Row
          icon="images-outline"
          title="Gallery"
          subtitle="See work samples and inspiration"
          onPress={() => navigation.navigate('Gallery')}
          iconBg={palette.primarySoft}
          iconColor={palette.primary}
          titleColor={palette.text}
          subtitleColor={palette.textMuted}
          borderColor={palette.border}
        />
        <Row
          icon="people-outline"
          title="Team"
          subtitle="Meet the salon professionals"
          onPress={() => navigation.navigate('Team')}
          iconBg={palette.primarySoft}
          iconColor={palette.primary}
          titleColor={palette.text}
          subtitleColor={palette.textMuted}
          borderColor={palette.border}
        />
        <Row
          icon="call-outline"
          title="Contact"
          subtitle="Call, message, or send support requests"
          onPress={() => navigation.navigate('Contact')}
          iconBg={palette.primarySoft}
          iconColor={palette.primary}
          titleColor={palette.text}
          subtitleColor={palette.textMuted}
          borderColor={palette.border}
        />
        <Row
          icon="shield-checkmark-outline"
          title="Admin"
          subtitle="Manage bookings and admin access"
          onPress={() => navigation.navigate('Admin')}
          iconBg={palette.primarySoft}
          iconColor={palette.primary}
          titleColor={palette.text}
          subtitleColor={palette.textMuted}
        />
      </Card>

      <SectionTitle color={palette.warm}>Appearance</SectionTitle>
      <Card backgroundColor={palette.card} borderColor={palette.border}>
        <View style={styles.themeRow}>
          {themeOptions.map((option) => {
            const active = themeMode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  triggerLightHaptic();
                  setThemeMode(option.value);
                }}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: active ? palette.primarySoft : palette.cardMuted,
                    borderColor: active ? palette.primary : palette.border
                  }
                ]}
              >
                <Ionicons name={option.icon} size={18} color={active ? palette.primary : palette.textMuted} />
                <Text style={[styles.themeOptionText, { color: active ? palette.primary : palette.text }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.helperText, { color: palette.textMuted }]}>
          Active mode: {resolvedColorScheme}. Use the header toggle any time.
        </Text>
      </Card>

      <SectionTitle color={palette.warm}>Support</SectionTitle>
      <Card backgroundColor={palette.card} borderColor={palette.border}>
        <Row
          icon="logo-whatsapp"
          title="WhatsApp support"
          subtitle="Fastest route for urgent booking help"
          onPress={() => openUrl('https://wa.me/2347036939125')}
          iconBg={isDark ? '#143428' : '#e9f7ef'}
          iconColor={palette.success}
          titleColor={palette.text}
          subtitleColor={palette.textMuted}
          borderColor={palette.border}
        />
        <Row
          icon="call-outline"
          title="Call salon"
          subtitle="07036939125"
          onPress={() => openUrl('tel:07036939125')}
          iconBg={palette.primarySoft}
          iconColor={palette.primary}
          titleColor={palette.text}
          subtitleColor={palette.textMuted}
          borderColor={palette.border}
        />
        <Row
          icon="globe-outline"
          title="Open website"
          subtitle="Visit the salon website"
          onPress={() => openUrl('https://ceosaloon.com')}
          iconBg={palette.primarySoft}
          iconColor={palette.primary}
          titleColor={palette.text}
          subtitleColor={palette.textMuted}
        />
      </Card>

      <SectionTitle color={palette.warm}>Storage</SectionTitle>
      <Card backgroundColor={palette.card} borderColor={palette.border}>
        <View style={styles.inlineActions}>
          <Pressable
            onPress={clearSavedBooking}
            style={({ pressed }) => [
              styles.secondaryAction,
              { backgroundColor: palette.cardMuted, borderColor: palette.border },
              pressed && styles.primaryActionPressed
            ]}
          >
            <Text style={[styles.secondaryActionText, { color: palette.text }]}>Clear saved booking</Text>
          </Pressable>
          <Pressable
            onPress={logoutDeviceData}
            style={({ pressed }) => [
              styles.secondaryAction,
              {
                backgroundColor: isDark ? '#301820' : '#fff2f2',
                borderColor: isDark ? '#5b2e3a' : '#f5c7c7'
              },
              pressed && styles.primaryActionPressed
            ]}
          >
            <Text style={[styles.secondaryActionText, { color: palette.danger }]}>Clear device data</Text>
          </Pressable>
        </View>
        <Text style={[styles.helperText, { color: palette.textMuted }]}>
          This clears locally saved tracking and admin session data on this device only.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: MOBILE_SPACE.xxl,
    paddingBottom: 28
  },
  hero: {
    borderRadius: MOBILE_SHAPE.cardRadius,
    borderWidth: 1,
    padding: MOBILE_SPACE.xxl,
    overflow: 'hidden',
    marginBottom: MOBILE_SPACE.xxl
  },
  heroGlowTop: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -90,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 203, 255, 0.14)'
  },
  heroKicker: {
    color: '#d9e6ff',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: MOBILE_TYPE.caption,
    marginBottom: 6
  },
  heroTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: MOBILE_TYPE.title,
    lineHeight: 30
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#d6e0f5',
    fontSize: MOBILE_TYPE.body,
    lineHeight: 20
  },
  sectionTitle: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  card: {
    borderRadius: MOBILE_SHAPE.cardRadius,
    borderWidth: 1,
    marginBottom: MOBILE_SPACE.xl,
    overflow: 'hidden',
    shadowColor: '#09111f',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 3
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  rowPressed: {
    opacity: 0.9
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowBody: {
    flex: 1
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17
  },
  themeRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14
  },
  themeOption: {
    flex: 1,
    minHeight: 82,
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8
  },
  themeOptionText: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  },
  helperText: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: MOBILE_TYPE.caption,
    lineHeight: 18
  },
  primaryActionPressed: {
    opacity: 0.88
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14
  },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  secondaryActionText: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800',
    textAlign: 'center'
  }
});
