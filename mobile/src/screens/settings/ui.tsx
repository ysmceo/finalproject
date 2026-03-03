import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { triggerLightHaptic } from '../../lib/haptics';

export function SettingsCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SettingsSectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function SettingsSearchBox({
  value,
  onChangeText,
  placeholder
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search-outline" size={18} color="#6b7280" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || 'Search for a setting…'}
        placeholderTextColor="#9ca3af"
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  noTopBorder
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  noTopBorder?: boolean;
}) {
  const baseStyle = [styles.row, noTopBorder && styles.rowNoTopBorder];

  const content = (
    <>
      <View style={styles.iconBubble}>
        <Ionicons name={icon} size={18} color="#5a31b3" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ? right : onPress ? <Ionicons name="chevron-forward" size={18} color="#ad9ad2" /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          triggerLightHaptic();
          onPress();
        }}
        style={({ pressed }) => [baseStyle, pressed && styles.rowPressed, pressed && styles.tapScale]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{content}</View>;
}

export function SettingsPill({
  label,
  onPress,
  variant
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const v = variant || 'primary';
  return (
    <Pressable
      onPress={() => {
        triggerLightHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.pill, styles[`pill_${v}` as const], pressed && styles.pillPressed, pressed && styles.tapScale]}
    >
      <Text style={[styles.pillText, styles[`pillText_${v}` as const]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ece7f6',
    overflow: 'hidden',
    shadowColor: '#1f1238',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#8b5a11',
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4dbf5'
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2f2745'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f2edf9'
  },
  rowNoTopBorder: {
    borderTopWidth: 0
  },
  rowPressed: {
    backgroundColor: '#f7f3ff'
  },
  tapScale: {
    transform: [{ scale: 0.985 }]
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4edff'
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2f2745'
  },
  rowSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#746a90'
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1
  },
  pillPressed: {
    opacity: 0.86
  },
  pill_primary: {
    backgroundColor: '#7c46e8',
    borderColor: '#7c46e8'
  },
  pill_ghost: {
    backgroundColor: '#fff',
    borderColor: '#d8cfee'
  },
  pill_danger: {
    backgroundColor: '#fef3f2',
    borderColor: '#fecaca'
  },
  pillText: {
    fontWeight: '800'
  },
  pillText_primary: {
    color: '#fff'
  },
  pillText_ghost: {
    color: '#4b3f69'
  },
  pillText_danger: {
    color: '#b42318'
  }
});
