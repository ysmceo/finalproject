import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      {...(onPress ? { onPress } : {})}
      style={({ pressed }: any) => [
        styles.row,
        noTopBorder && styles.rowNoTopBorder,
        onPress && pressed && styles.rowPressed
      ]}
    >
      <View style={styles.iconBubble}>
        <Ionicons name={icon} size={18} color="#111827" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ? (
        right
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      ) : null}
    </Wrapper>
  );
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
      onPress={onPress}
      style={({ pressed }) => [styles.pill, styles[`pill_${v}` as const], pressed && styles.pillPressed]}
    >
      <Text style={[styles.pillText, styles[`pillText_${v}` as const]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#61666f',
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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f2f4'
  },
  rowNoTopBorder: {
    borderTopWidth: 0
  },
  rowPressed: {
    backgroundColor: '#f7f8fb'
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6'
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  rowSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280'
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
    backgroundColor: '#b78a2a',
    borderColor: '#b78a2a'
  },
  pill_ghost: {
    backgroundColor: '#fff',
    borderColor: '#d8dbe3'
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
    color: '#374151'
  },
  pillText_danger: {
    color: '#b42318'
  }
});
