import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_MODE_KEY = 'ceosalon:themeMode';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedColorScheme: 'light' | 'dark';
  navigationTheme: Theme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveColorScheme(mode: ThemeMode, systemScheme: ColorSchemeName): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (!active) return;
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setModeState(stored);
        }
      } catch {
        // ignore
      }
    })();

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const resolvedColorScheme = resolveColorScheme(mode, systemScheme);

  const navigationTheme = useMemo<Theme>(() => {
    const base = resolvedColorScheme === 'dark' ? DarkTheme : DefaultTheme;
    // Make background white even in light mode for a clean "settings" look.
    const background = resolvedColorScheme === 'dark' ? '#0f1115' : '#ffffff';

    return {
      ...base,
      colors: {
        ...base.colors,
        background,
        card: resolvedColorScheme === 'dark' ? '#151824' : '#ffffff'
      }
    };
  }, [resolvedColorScheme]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => undefined);
  };

  const value = useMemo<ThemeContextValue>(() => {
    return { mode, setMode, resolvedColorScheme, navigationTheme };
  }, [mode, resolvedColorScheme, navigationTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePrefs(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemePrefs must be used within ThemeProvider');
  }
  return ctx;
}

export const themeStorageKeys = {
  THEME_MODE_KEY
};
