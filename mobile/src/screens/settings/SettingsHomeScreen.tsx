import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { SettingsStackParamList } from '../SettingsNavigator';
import { SettingsCard, SettingsRow, SettingsSearchBox, SettingsSectionTitle } from './ui';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

type Item = {
  key: string;
  title: string;
  icon: any;
  route: keyof SettingsStackParamList;
  section: 'Account' | 'Preferences' | 'Support' | 'About';
};

export default function SettingsHomeScreen({ navigation }: Props) {
  const [q, setQ] = useState('');

  const items = useMemo<Item[]>(() => {
    return [
      { key: 'account', title: 'Account', icon: 'person-outline', route: 'Account', section: 'Account' },
      { key: 'notifications', title: 'Notifications', icon: 'notifications-outline', route: 'Notifications', section: 'Preferences' },
      { key: 'appearance', title: 'Appearance', icon: 'color-palette-outline', route: 'Appearance', section: 'Preferences' },
      { key: 'privacy', title: 'Privacy & Security', icon: 'lock-closed-outline', route: 'PrivacySecurity', section: 'Preferences' },
      { key: 'help', title: 'Help and Support', icon: 'help-circle-outline', route: 'HelpSupport', section: 'Support' },
      { key: 'about', title: 'About', icon: 'information-circle-outline', route: 'About', section: 'About' }
    ];
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(i => i.title.toLowerCase().includes(term));
  }, [items, q]);

  const bySection = useMemo(() => {
    const sections: Array<Item['section']> = ['Account', 'Preferences', 'Support', 'About'];
    return sections
      .map(section => ({
        section,
        rows: filtered.filter(i => i.section === section)
      }))
      .filter(s => s.rows.length > 0);
  }, [filtered]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SettingsSearchBox value={q} onChangeText={setQ} />

      {bySection.map((s) => (
        <View key={s.section}>
          <SettingsSectionTitle>{s.section}</SettingsSectionTitle>
          <SettingsCard>
            {/* First row should not render a top border */}
            {s.rows.map((row, idx) => (
              <SettingsRow
                key={row.key}
                icon={row.icon}
                title={row.title}
                onPress={() => navigation.navigate(row.route)}
                noTopBorder={idx === 0}
              />
            ))}
          </SettingsCard>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30
  }
});
