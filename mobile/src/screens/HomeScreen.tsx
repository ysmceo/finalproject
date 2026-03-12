import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useThemePrefs } from '../theme';
import { getMobilePalette, MOBILE_MOTION, MOBILE_SHAPE, MOBILE_SPACE, MOBILE_TYPE } from '../ui/polish';
import { ThemedScrollView } from '../ui/ThemedScrollView';
import { apiGet } from '../lib/api';
import { resolveImageUri } from '../lib/images';
import { triggerLightHaptic } from '../lib/haptics';
import type { Service, Product } from '../types';

// Lagos coordinates for weather
const WEATHER_LAT = 6.5244;
const WEATHER_LON = 3.3792;

type WeatherData = {
  temperature: number;
  weatherCode: number;
  iconName: keyof typeof Ionicons.glyphMap;
  loading: boolean;
  error?: string;
};

function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code >= 1 && code <= 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '☁️';
}

function getWeatherIconName(code: number): keyof typeof Ionicons.glyphMap {
  if (code === 0) return 'sunny-outline';
  if (code >= 1 && code <= 3) return 'partly-sunny-outline';
  if (code >= 45 && code <= 48) return 'cloud-outline';
  if (code >= 51 && code <= 67) return 'rainy-outline';
  if (code >= 71 && code <= 77) return 'snow-outline';
  if (code >= 80 && code <= 82) return 'rainy-outline';
  if (code >= 85 && code <= 86) return 'thunderstorm-outline';
  if (code >= 95) return 'thunderstorm-outline';
  return 'cloud-outline';
}

function formatTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return now.toLocaleDateString('en-US', options);
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  const [currentTime, setCurrentTime] = useState(formatTime());
  const [currentDate, setCurrentDate] = useState(formatDate());
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    weatherCode: 0,
    iconName: 'cloud-outline',
    loading: true
  });
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [failedCeoImages, setFailedCeoImages] = useState<Record<string, true>>({});

  const screenEntry = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(screenEntry, {
      toValue: 1,
      duration: MOBILE_MOTION.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [screenEntry]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime());
      setCurrentDate(formatDate());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load weather data
  useEffect(() => {
    let active = true;
    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current_weather=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        if (!active) return;
        
        const current = data?.current_weather;
        setWeather({
          temperature: current?.temperature ?? 0,
          weatherCode: current?.weathercode ?? 0,
          iconName: getWeatherIconName(current?.weathercode ?? 0),
          loading: false
        });
      } catch (error) {
        if (!active) return;
        setWeather({
          temperature: 0,
          weatherCode: 0,
          iconName: 'cloud-outline',
          loading: false,
          error: 'Unable to load weather'
        });
      }
    };

    fetchWeather();
    // Update weather every 5 minutes
    const weatherInterval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(weatherInterval);
    };
  }, []);

  // Load services and products
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [svc, productList] = await Promise.all([
          apiGet<Service[]>('/api/services'),
          apiGet<Product[]>('/api/products')
        ]);
        if (!active) return;
        setServices(svc || []);
        setProducts(productList || []);
      } catch (error) {
        // Ignore errors - services will show empty
      } finally {
        if (active) setLoadingServices(false);
      }
    })();
    return () => { active = false; };
  }, []);

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
    primaryBg: { backgroundColor: palette.primary },
    primarySoft: { backgroundColor: palette.primarySoft },
    heroCard: { backgroundColor: isDark ? '#172744' : '#eff5ff', borderColor: isDark ? '#314b7e' : '#cfdcf6' },
    heroKicker: { color: isDark ? '#dbe6ff' : palette.warm },
    heroTitle: { color: isDark ? '#ffffff' : '#16233b' },
    heroSubtle: { color: isDark ? '#d2ddf1' : '#5e718c' },
    infoCard: {
      backgroundColor: isDark ? 'rgba(11, 18, 32, 0.22)' : 'rgba(255,255,255,0.84)',
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#dae4f5'
    },
    clockLabel: { color: isDark ? '#f8e9b3' : palette.warm },
    clockTime: { color: isDark ? '#ffffff' : '#13233c' },
    clockDate: { color: isDark ? '#d8e3fb' : '#5d708c' },
    weatherCard: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e9f0ff',
      borderColor: isDark ? 'rgba(255,255,255,0.16)' : '#cad8f2'
    },
    weatherCaption: { color: isDark ? '#f8e9b3' : palette.primary },
    weatherText: { color: isDark ? '#ffffff' : '#1a2a44' },
    featureChip: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#ffffff',
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : '#d7e2f5'
    },
    featureChipText: { color: isDark ? '#ffffff' : '#274268' }
  };

  const quickActions = [
    { key: 'book', label: 'Book Now', icon: 'calendar', color: palette.primary, screen: 'Book' },
    { key: 'track', label: 'Track', icon: 'search', color: palette.warm, screen: 'Track' },
    { key: 'gallery', label: 'Gallery', icon: 'images', color: palette.secondary, screen: 'Gallery' },
    { key: 'team', label: 'Team', icon: 'people', color: palette.success, screen: 'Team' }
  ];

  const handleQuickAction = (screen: string) => {
    triggerLightHaptic();
    if (screen === 'Book') {
      navigation.navigate('Book');
    } else if (screen === 'Track') {
      navigation.navigate('Track');
    } else if (screen === 'Gallery') {
      navigation.navigate('Gallery');
    } else if (screen === 'Team') {
      navigation.navigate('Team');
    } else if (screen === 'Contact') {
      navigation.navigate('Contact');
    }
  };

  const featuredServices = services.slice(0, 4);
  const featuredProducts = products.slice(0, 4);

  const openLinkWithHaptic = (url: string) => {
    triggerLightHaptic();
    Linking.openURL(url);
  };

  return (
    <ThemedScrollView 
      style={[styles.container, themed.container]} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <Animated.View style={[styles.heroCard, themed.heroCard, cardIn(20)]}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.heroHeader}>
          <Text style={[styles.heroKicker, themed.heroKicker]}>CEO UNISEX SALON</Text>
          <Text style={[styles.heroTitle, themed.heroTitle]}>Where Beauty Meets Excellence</Text>
          <Text style={[styles.heroTagline, themed.heroSubtle]}>Luxury grooming, trusted professionals, modern care</Text>
        </View>
        
        {/* Clock & Weather */}
        <View style={[styles.infoCard, themed.infoCard]}>
          <View style={styles.clockSection}>
            <Text style={[styles.clockLabel, themed.clockLabel]}>Current time</Text>
            <Text style={[styles.clockTime, themed.clockTime]}>{currentTime}</Text>
            <Text style={[styles.clockDate, themed.clockDate]}>{currentDate}</Text>
          </View>
          <View style={[styles.weatherSection, themed.weatherCard]}>
            <Text style={[styles.weatherCaption, themed.weatherCaption]}>Weather</Text>
            <Ionicons
              name={weather.loading ? 'time-outline' : weather.iconName}
              size={28}
              color={isDark ? '#ffffff' : palette.primary}
              style={styles.weatherIcon}
            />
            <Text style={[styles.weatherTemp, themed.weatherText]}>
              {weather.loading ? '...' : weather.error ? '-- C' : `${Number(weather.temperature || 0).toFixed(1)} C`}
            </Text>
            <Text style={[styles.weatherLabel, themed.weatherText]}>Lagos</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[styles.quickActionBtn, { backgroundColor: action.color }]}
              activeOpacity={0.88}
              onPress={() => handleQuickAction(action.screen)}
            >
              <Ionicons name={action.icon as any} size={20} color="#fff" />
              <Text style={styles.quickActionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.whatsAppCta}
          activeOpacity={0.9}
          onPress={() => openLinkWithHaptic('https://wa.me/2347036939125')}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={styles.whatsAppCtaText}>Chat us on WhatsApp</Text>
        </TouchableOpacity>

        <View style={styles.featureChipsRow}>
          <View style={[styles.featureChip, themed.featureChip]}>
            <Text style={[styles.featureChipText, themed.featureChipText]}>Premium Care</Text>
          </View>
          <View style={[styles.featureChip, themed.featureChip]}>
            <Text style={[styles.featureChipText, themed.featureChipText]}>Pro Stylists</Text>
          </View>
          <View style={[styles.featureChip, themed.featureChip]}>
            <Text style={[styles.featureChipText, themed.featureChipText]}>Hygienic Tools</Text>
          </View>
        </View>
      </Animated.View>

      {/* Featured Services */}
      <Animated.View style={[styles.sectionCard, themed.cardElevated, cardIn(28)]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, themed.text]}>Our Services</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => handleQuickAction('Book')}>
            <Text style={[styles.seeAllText, themed.primary]}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {loadingServices ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          <View style={styles.servicesGrid}>
            {featuredServices.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[styles.serviceCard, themed.cardMuted]}
                activeOpacity={0.9}
                onPress={() => handleQuickAction('Book')}
              >
                <Ionicons name="cut" size={24} color={palette.primary} />
                <Text style={[styles.serviceName, themed.text]} numberOfLines={1}>{service.name}</Text>
                <Text style={[styles.servicePrice, themed.primary]}>₦{Number(service.price || 0).toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
            {featuredServices.length === 0 && (
              <Text style={[styles.emptyText, themed.textMuted]}>No services available</Text>
            )}
          </View>
        )}
      </Animated.View>

      {/* Featured Products */}
      <Animated.View style={[styles.sectionCard, themed.cardElevated, cardIn(34)]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, themed.text]}>Products</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => handleQuickAction('Book')}>
            <Text style={[styles.seeAllText, themed.primary]}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {loadingServices ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          <View style={styles.productsGrid}>
            {featuredProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[styles.productCard, themed.cardMuted]}
                activeOpacity={0.9}
                onPress={() => handleQuickAction('Book')}
              >
                {resolveImageUri(product.image) ? (
                  <Image
                    source={{ uri: resolveImageUri(product.image)! }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.productImagePlaceholder, themed.primarySoft]}>
                    <Ionicons name="image-outline" size={24} color={palette.primary} />
                  </View>
                )}
                <Text style={[styles.productName, themed.text]} numberOfLines={1}>{product.name}</Text>
                <Text style={[styles.productCategory, themed.textMuted]}>{product.category}</Text>
                <Text style={[styles.productPrice, themed.primary]}>₦{Number(product.price || 0).toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
            {featuredProducts.length === 0 && (
              <Text style={[styles.emptyText, themed.textMuted]}>No products available</Text>
            )}
          </View>
        )}
      </Animated.View>

      {/* CEO Spotlight Preview */}
      <Animated.View style={[styles.sectionCard, themed.cardElevated, cardIn(40)]}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => handleQuickAction('Team')}>
          <Text style={[styles.sectionTitle, themed.text]}>Meet Our CEOs</Text>
        </TouchableOpacity>
        <View style={styles.ceoPreview}>
          <TouchableOpacity activeOpacity={0.9} style={[styles.ceoCard, themed.cardMuted]} onPress={() => handleQuickAction('Team')}>
            {!failedCeoImages.victor ? (
              <Image
                source={{ uri: resolveImageUri('/images/ysmceo.jpeg') || undefined }}
                style={styles.ceoAvatarImage}
                resizeMode="cover"
                onError={() => setFailedCeoImages((prev) => ({ ...prev, victor: true }))}
              />
            ) : (
              <View style={[styles.ceoAvatar, themed.primarySoft]}>
                <Ionicons name="person" size={32} color={palette.primary} />
              </View>
            )}
            <Text style={[styles.ceoName, themed.text]}>Okonta Victor</Text>
            <Text style={[styles.ceoRole, themed.textMuted]}>CEO</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} style={[styles.ceoCard, themed.cardMuted]} onPress={() => handleQuickAction('Team')}>
            {!failedCeoImages.lizzy ? (
              <Image
                source={{ uri: resolveImageUri('/images/ysmwife.jpeg') || undefined }}
                style={styles.ceoAvatarImage}
                resizeMode="cover"
                onError={() => setFailedCeoImages((prev) => ({ ...prev, lizzy: true }))}
              />
            ) : (
              <View style={[styles.ceoAvatar, themed.primarySoft]}>
                <Ionicons name="person" size={32} color={palette.primary} />
              </View>
            )}
            <Text style={[styles.ceoName, themed.text]}>Okonta Lizzy</Text>
            <Text style={[styles.ceoRole, themed.textMuted]}>CEO</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Contact Quick */}
      <Animated.View style={[styles.sectionCard, themed.cardElevated, cardIn(46)]}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => handleQuickAction('Contact')}>
          <Text style={[styles.sectionTitle, themed.text]}>Contact Us</Text>
        </TouchableOpacity>
        <View style={styles.contactRow}>
          <TouchableOpacity 
            style={[styles.contactBtn, themed.cardMuted]}
            activeOpacity={0.88}
            onPress={() => openLinkWithHaptic('tel:07036939125')}
          >
            <Ionicons name="call" size={20} color={palette.primary} />
            <Text style={[styles.contactBtnText, themed.text]}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.contactBtn, themed.cardMuted]}
            activeOpacity={0.88}
            onPress={() => openLinkWithHaptic('https://wa.me/2347036939125')}
          >
            <Ionicons name="logo-whatsapp" size={20} color={palette.success} />
            <Text style={[styles.contactBtnText, themed.text]}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.contactBtn, themed.cardMuted]}
            activeOpacity={0.88}
            onPress={() => openLinkWithHaptic('mailto:okontaysm@gmail.com')}
          >
            <Ionicons name="mail" size={20} color={palette.primary} />
            <Text style={[styles.contactBtnText, themed.text]}>Email</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={[styles.sectionCard, themed.cardElevated, cardIn(52)]}>
        <Text style={[styles.sectionTitle, themed.text]}>Professional Standards</Text>
        <View style={styles.standardsGrid}>
          <View style={[styles.standardItem, themed.cardMuted]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={palette.primary} />
            <Text style={[styles.standardTitle, themed.text]}>Secure process</Text>
            <Text style={[styles.standardText, themed.textMuted]}>Structured booking and order flow with status updates.</Text>
          </View>
          <View style={[styles.standardItem, themed.cardMuted]}>
            <Ionicons name="medkit-outline" size={18} color={palette.primary} />
            <Text style={[styles.standardTitle, themed.text]}>Clean tools</Text>
            <Text style={[styles.standardText, themed.textMuted]}>Hygienic tools and careful service routine.</Text>
          </View>
          <View style={[styles.standardItem, themed.cardMuted]}>
            <Ionicons name="time-outline" size={18} color={palette.primary} />
            <Text style={[styles.standardTitle, themed.text]}>On-time support</Text>
            <Text style={[styles.standardText, themed.textMuted]}>Fast response via call, email, and WhatsApp.</Text>
          </View>
        </View>
      </Animated.View>

      <View style={styles.bottomSpacer} />
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f6ff'
  },
  contentContainer: {
    padding: MOBILE_SPACE.lg
  },
  heroCard: {
    backgroundColor: '#384a72',
    borderRadius: MOBILE_SHAPE.cardRadius,
    padding: MOBILE_SPACE.xl,
    borderWidth: 1,
    borderColor: '#5a6f99',
    shadowColor: '#1d2538',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden'
  },
  heroGlowOne: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 999,
    top: -70,
    right: -45,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 999,
    bottom: -90,
    left: -70,
    backgroundColor: 'rgba(176, 198, 236, 0.14)'
  },
  heroHeader: {
    marginBottom: MOBILE_SPACE.lg
  },
  heroKicker: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800',
    color: '#d6e1f8',
    letterSpacing: 1,
    marginBottom: 4
  },
  heroTitle: {
    fontSize: MOBILE_TYPE.title,
    fontWeight: '900',
    color: '#fff'
  },
  heroTagline: {
    marginTop: MOBILE_SPACE.sm,
    fontSize: MOBILE_TYPE.caption,
    color: '#efe6ff',
    fontWeight: '700'
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: MOBILE_SPACE.md,
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.lg,
    marginBottom: MOBILE_SPACE.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  clockSection: {
    flex: 1,
    paddingRight: MOBILE_SPACE.sm
  },
  clockLabel: {
    fontSize: MOBILE_TYPE.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#f8e9b3',
    marginBottom: 2
  },
  clockTime: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4
  },
  clockDate: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    color: '#e9dfff',
    marginTop: 2
  },
  weatherSection: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.md,
    minWidth: 96,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  weatherCaption: {
    fontSize: MOBILE_TYPE.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#f8e9b3',
    fontWeight: '800',
    marginBottom: 2
  },
  weatherIcon: {
    fontSize: 30
  },
  weatherTemp: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff'
  },
  weatherLabel: {
    fontSize: MOBILE_TYPE.caption,
    color: '#f2e8ff',
    fontWeight: '700'
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.sm
  },
  featureChipsRow: {
    marginTop: MOBILE_SPACE.md,
    flexDirection: 'row',
    gap: MOBILE_SPACE.sm,
    flexWrap: 'wrap'
  },
  featureChip: {
    paddingHorizontal: MOBILE_SPACE.md,
    paddingVertical: MOBILE_SPACE.xs,
    borderRadius: MOBILE_SHAPE.chipRadius,
    borderWidth: 1
  },
  featureChipText: {
    color: '#fff',
    fontSize: MOBILE_TYPE.micro,
    fontWeight: '800'
  },
  quickActionBtn: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    paddingVertical: MOBILE_SPACE.md,
    borderRadius: MOBILE_SHAPE.controlRadius,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#1e0a3f',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3
  },
  quickActionText: {
    color: '#fff',
    fontSize: MOBILE_TYPE.micro,
    fontWeight: '800',
    textAlign: 'center'
  },
  whatsAppCta: {
    marginTop: MOBILE_SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: MOBILE_SPACE.sm,
    backgroundColor: '#248f5a',
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingVertical: MOBILE_SPACE.md,
    shadowColor: '#1d5a3b',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3
  },
  whatsAppCtaText: {
    color: '#fff',
    fontSize: MOBILE_TYPE.body,
    fontWeight: '800'
  },
  sectionCard: {
    marginTop: MOBILE_SPACE.lg,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: MOBILE_SPACE.md
  },
  sectionTitle: {
    fontSize: MOBILE_TYPE.heading,
    fontWeight: '800'
  },
  seeAllText: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800'
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.md
  },
  serviceCard: {
    width: '47%',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.md,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#1a0f33',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  serviceName: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    marginTop: MOBILE_SPACE.sm,
    textAlign: 'center'
  },
  servicePrice: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800',
    marginTop: 2
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MOBILE_SPACE.md
  },
  productCard: {
    width: '47%',
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.md,
    borderWidth: 1,
    shadowColor: '#1a0f33',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  productImagePlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: MOBILE_SHAPE.inputRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MOBILE_SPACE.sm
  },
  productImage: {
    width: '100%',
    height: 80,
    borderRadius: MOBILE_SHAPE.inputRadius,
    marginBottom: MOBILE_SPACE.sm,
    backgroundColor: '#e9e0ff'
  },
  productName: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    textAlign: 'center'
  },
  productCategory: {
    fontSize: MOBILE_TYPE.micro,
    marginTop: 2
  },
  productPrice: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '800',
    marginTop: 2
  },
  emptyText: {
    textAlign: 'center',
    padding: MOBILE_SPACE.xl,
    width: '100%'
  },
  ceoPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: MOBILE_SPACE.md
  },
  ceoCard: {
    alignItems: 'center',
    padding: MOBILE_SPACE.lg,
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    width: '45%',
    shadowColor: '#1a0f33',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  ceoAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MOBILE_SPACE.sm
  },
  ceoAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: MOBILE_SPACE.sm,
    backgroundColor: '#e9e0ff'
  },
  ceoName: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '800',
    textAlign: 'center'
  },
  ceoRole: {
    fontSize: MOBILE_TYPE.caption,
    marginTop: 2
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: MOBILE_SPACE.md,
    gap: MOBILE_SPACE.sm
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: MOBILE_SPACE.md,
    borderRadius: MOBILE_SHAPE.controlRadius,
    borderWidth: 1,
    gap: 4,
    shadowColor: '#1a0f33',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  contactBtnText: {
    fontSize: MOBILE_TYPE.micro,
    fontWeight: '700'
  },
  standardsGrid: {
    marginTop: MOBILE_SPACE.md,
    gap: MOBILE_SPACE.sm
  },
  standardItem: {
    borderWidth: 1,
    borderRadius: MOBILE_SHAPE.controlRadius,
    padding: MOBILE_SPACE.md,
    gap: 4
  },
  standardTitle: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '800'
  },
  standardText: {
    fontSize: MOBILE_TYPE.caption,
    lineHeight: 18
  },
  bottomSpacer: {
    height: MOBILE_SPACE.xxl
  }
});

