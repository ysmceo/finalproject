import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type HapticKind = 'light' | 'medium' | 'warning' | 'success';
export type HapticPreset = 'subtle' | 'balanced' | 'strong';

const DEFAULT_HAPTIC_COOLDOWN_MS: Record<HapticKind, number> = {
  light: 80,
  medium: 140,
  warning: 260,
  success: 260
};

const HAPTIC_PRESET_COOLDOWNS: Record<HapticPreset, Record<HapticKind, number>> = {
  subtle: {
    light: 120,
    medium: 190,
    warning: 320,
    success: 320
  },
  balanced: { ...DEFAULT_HAPTIC_COOLDOWN_MS },
  strong: {
    light: 40,
    medium: 90,
    warning: 180,
    success: 180
  }
};

const hapticCooldownMs: Record<HapticKind, number> = { ...DEFAULT_HAPTIC_COOLDOWN_MS };

const lastFiredAt: Record<HapticKind, number> = {
  light: 0,
  medium: 0,
  warning: 0,
  success: 0
};

function canUseHaptics() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function shouldFire(kind: HapticKind) {
  const now = Date.now();
  const elapsed = now - lastFiredAt[kind];
  if (elapsed < hapticCooldownMs[kind]) return false;
  lastFiredAt[kind] = now;
  return true;
}

export function setHapticCooldownMs(overrides: Partial<Record<HapticKind, number>>) {
  (Object.keys(overrides) as HapticKind[]).forEach((kind) => {
    const value = overrides[kind];
    if (typeof value === 'number' && Number.isFinite(value)) {
      hapticCooldownMs[kind] = Math.max(0, value);
    }
  });
}

export function resetHapticCooldownMs() {
  (Object.keys(DEFAULT_HAPTIC_COOLDOWN_MS) as HapticKind[]).forEach((kind) => {
    hapticCooldownMs[kind] = DEFAULT_HAPTIC_COOLDOWN_MS[kind];
  });
}

export function applyHapticPreset(preset: HapticPreset) {
  const profile = HAPTIC_PRESET_COOLDOWNS[preset] || HAPTIC_PRESET_COOLDOWNS.balanced;
  setHapticCooldownMs(profile);
}

export function triggerLightHaptic() {
  if (!canUseHaptics()) return;
  if (!shouldFire('light')) return;
  Haptics.selectionAsync().catch(() => undefined);
}

export function triggerMediumHaptic() {
  if (!canUseHaptics()) return;
  if (!shouldFire('medium')) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

export function triggerWarningHaptic() {
  if (!canUseHaptics()) return;
  if (!shouldFire('warning')) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

export function triggerSuccessHaptic() {
  if (!canUseHaptics()) return;
  if (!shouldFire('success')) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
