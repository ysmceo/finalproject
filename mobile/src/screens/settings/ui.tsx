import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { triggerLightHaptic } from '../../lib/haptics';
import { useThemePrefs } from '../../theme';
import { getMobilePalette } from '../../ui/polish';

export function SettingsCard({ children }: { children: React.ReactNode }) {
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');

  return <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>{children}</View>;
}

export function SettingsSectionTitle({ children }: { children: React.ReactNode }) {
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');

  return <Text style={[styles.sectionTitle, { color: palette.warm }]}>{children}</Text>;
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
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');

  return (
    <View style={[styles.searchWrap, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Ionicons name="search-outline" size={18} color={palette.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || 'Search settings'}
        placeholderTextColor={palette.textMuted}
        style={[styles.searchInput, { color: palette.text }]}
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
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');
  const baseStyle = [
    styles.row,
    { borderTopColor: palette.border },
    noTopBorder && styles.rowNoTopBorder
  ];

  const content = (
    <>
      <View style={[styles.iconBubble, { backgroundColor: palette.primarySoft }]}>
        <Ionicons name={icon} size={18} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: palette.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right ? right : onPress ? <Ionicons name="chevron-forward" size={18} color={palette.textMuted} /> : null}
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
          baseStyle,
          pressed && { backgroundColor: palette.cardMuted },
          pressed && styles.tapScale
        ]}
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
  const { resolvedColorScheme } = useThemePrefs();
  const palette = getMobilePalette(resolvedColorScheme === 'dark');
  const v = variant || 'primary';

  const colorMap = {
    primary: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
      color: '#ffffff'
    },
    ghost: {
      backgroundColor: palette.card,
      borderColor: palette.border,
      color: palette.text
    },
    danger: {
      backgroundColor: resolvedColorScheme === 'dark' ? '#301820' : '#fff2f2',
      borderColor: resolvedColorScheme === 'dark' ? '#5b2e3a' : '#f5c7c7',
      color: palette.danger
    }
  } as const;

  const current = colorMap[v];

  return (
    <Pressable
      onPress={() => {
        triggerLightHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: current.backgroundColor,
          borderColor: current.borderColor
        },
        pressed && styles.pillPressed
      ]}
    >
      <Text style={[styles.pillText, { color: current.color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
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
    borderWidth: 1
  },
  searchInput: {
    flex: 1,
    fontSize: 14
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: 1
  },
  rowNoTopBorder: {
    borderTopWidth: 0
  },
  tapScale: {
    transform: [{ scale: 0.985 }]
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  rowSub: {
    marginTop: 4,
    fontSize: 12
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
  pillText: {
    fontWeight: '800'
  }
});
