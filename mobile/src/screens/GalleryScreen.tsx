import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
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

// Gallery images - in production these would come from an API
const GALLERY_IMAGES = [
  { id: '1', title: 'Hair Styling', category: 'Styling', uri: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400' },
  { id: '2', title: 'Color Treatment', category: 'Color', uri: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400' },
  { id: '3', title: 'Haircut', category: 'Cut', uri: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400' },
  { id: '4', title: 'Facial Treatment', category: 'Spa', uri: 'images/p2 hair color.jpg' },
  { id: '5', title: 'Manicure', category: 'Nails', uri: 'images/p1.webp' },
  { id: '6', title: 'Bridal Makeup', category: 'Makeup', uri: 'images/p3.jpg' },
  { id: '7', title: 'Massage', category: 'Spa', uri: 'images/p5 relaxation services.jpg' },
  { id: '8', title: 'Hair Treatment', category: 'Treatment', uri: 'images/p6 styling.jpg' },
];

type GalleryItem = {
  id: string;
  title: string;
  category: string;
  uri: string;
};

export default function GalleryScreen() {
  const { resolvedColorScheme } = useThemePrefs();
  const isDark = resolvedColorScheme === 'dark';
  const palette = getMobilePalette(isDark);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
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

  const categories = ['All', 'Styling', 'Color', 'Cut', 'Spa', 'Makeup', 'Treatment', 'Nails'];

  const filteredImages = selectedCategory === 'All' 
    ? GALLERY_IMAGES 
    : GALLERY_IMAGES.filter(img => img.category === selectedCategory);

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
    text: { color: palette.text },
    textMuted: { color: palette.textMuted },
    primary: { color: palette.primary },
    hero: { backgroundColor: isDark ? '#283247' : '#384a72', borderColor: isDark ? '#516287' : '#5a6f99' }
  };

  const renderGalleryItem = ({ item, index }: { item: GalleryItem; index: number }) => (
    <Animated.View style={[styles.galleryItem, cardIn(index * 10)]}>
      <Pressable
        style={({ pressed }) => [styles.galleryItemInner, pressed && styles.pressed]}
        onPress={() => {
          triggerLightHaptic();
          setSelectedImage(item);
        }}
      >
        {resolveImageUri(item.uri) && !failedImageIds[item.id] ? (
          <Image
            source={{ uri: resolveImageUri(item.uri)! }}
            style={styles.galleryImage}
            resizeMode="cover"
            onError={() => {
              setFailedImageIds((prev) => ({ ...prev, [item.id]: true }));
            }}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={28} color={palette.primary} />
          </View>
        )}
        <View style={[styles.imageInfo, themed.cardElevated]}>
          <Text style={[styles.imageTitle, themed.text]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.imageCategory, themed.textMuted]}>{item.category}</Text>
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
        <Text style={styles.headerTitle}>Gallery</Text>
        <Text style={styles.headerSubtitle}>Our beautiful work</Text>
      </Animated.View>

      {/* Category Filter */}
      <Animated.View style={[styles.categoryContainer, cardIn(15)]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                themed.card,
                selectedCategory === item && { backgroundColor: palette.primary }
              ]}
              activeOpacity={0.88}
              onPress={() => {
                triggerLightHaptic();
                setSelectedCategory(item);
              }}
            >
              <Text 
                style={[
                  styles.categoryText,
                  themed.text,
                  selectedCategory === item && { color: '#fff' }
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>

      {/* Gallery Grid */}
      <FlatList
        data={filteredImages}
        keyExtractor={(item) => item.id}
        renderItem={renderGalleryItem}
        numColumns={2}
        contentContainerStyle={styles.galleryGrid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, themed.textMuted]}>No images in this category</Text>
          </View>
        }
      />

      {/* Image Viewer Modal */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            triggerLightHaptic();
            setSelectedImage(null);
          }}
        >
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedImage && (
              <>
                {resolveImageUri(selectedImage.uri) && !failedImageIds[selectedImage.id] ? (
                  <Image
                    source={{ uri: resolveImageUri(selectedImage.uri)! }}
                    style={styles.modalImage}
                    resizeMode="cover"
                    onError={() => {
                      setFailedImageIds((prev) => ({ ...prev, [selectedImage.id]: true }));
                    }}
                  />
                ) : (
                  <View style={styles.modalImagePlaceholder}>
                    <Ionicons name="image-outline" size={64} color={palette.primary} />
                  </View>
                )}
                <Text style={[styles.modalTitle, themed.text]}>{selectedImage.title}</Text>
                <Text style={[styles.modalCategory, themed.textMuted]}>{selectedImage.category}</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => {
                    triggerLightHaptic();
                    setSelectedImage(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Modal>
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
  categoryContainer: {
    paddingBottom: MOBILE_SPACE.md,
    marginTop: MOBILE_SPACE.md
  },
  categoryList: {
    paddingHorizontal: MOBILE_SPACE.lg,
    gap: MOBILE_SPACE.sm
  },
  categoryChip: {
    paddingHorizontal: MOBILE_SPACE.lg,
    paddingVertical: MOBILE_SPACE.sm,
    borderRadius: MOBILE_SHAPE.chipRadius,
    borderWidth: 1,
    marginRight: MOBILE_SPACE.sm,
    shadowColor: '#1a0f33',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1
  },
  categoryText: {
    fontSize: MOBILE_TYPE.caption,
    fontWeight: '700'
  },
  galleryGrid: {
    padding: MOBILE_SPACE.md,
    paddingTop: MOBILE_SPACE.sm
  },
  galleryItem: {
    flex: 1,
    maxWidth: '50%',
    padding: MOBILE_SPACE.sm
  },
  galleryItemInner: {
    borderRadius: MOBILE_SHAPE.controlRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e6dcff',
    shadowColor: '#1a0f33',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 3
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }]
  },
  imagePlaceholder: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center'
  },
  galleryImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#e0d6f7'
  },
  imageInfo: {
    padding: MOBILE_SPACE.md,
    borderTopWidth: 1,
    borderTopColor: '#ece3ff'
  },
  imageTitle: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700'
  },
  imageCategory: {
    fontSize: MOBILE_TYPE.micro,
    marginTop: 2
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: MOBILE_SPACE.xxl
  },
  emptyText: {
    fontSize: MOBILE_TYPE.body
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: MOBILE_SPACE.xl,
    minHeight: '100%'
  },
  modalImagePlaceholder: {
    width: 280,
    height: 280,
    borderRadius: MOBILE_SHAPE.cardRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MOBILE_SPACE.lg
  },
  modalImage: {
    width: 280,
    height: 280,
    borderRadius: MOBILE_SHAPE.cardRadius,
    marginBottom: MOBILE_SPACE.lg,
    backgroundColor: '#e0d6f7'
  },
  modalTitle: {
    fontSize: MOBILE_TYPE.heading,
    fontWeight: '800',
    marginBottom: MOBILE_SPACE.xs
  },
  modalCategory: {
    fontSize: MOBILE_TYPE.body
  },
  closeButton: {
    position: 'absolute',
    top: MOBILE_SPACE.xl,
    right: MOBILE_SPACE.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4
  }
});

